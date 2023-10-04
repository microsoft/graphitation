/**
 * BIG TODOs:
 *
 * - Do we need, and can we have, any merge logic from type-policies ported over?
 *
 * - Make GC work
 *
 * - Relay IR will only contain metadata upto a fragment boundary and so either
 *   we need to recursively get data from the store across these boundaries or
 *   when the IR is generated we inline all fragments into a query? I'm unsure
 *   how that would work for write/readFragment, though, so perhaps recursively
 *   getting the data is the way to go.
 *
 * Notes:
 *
 * - The RelayModernStore expects data to already be normalized.
 *   https://github.com/facebook/relay/blob/v14.1.0/packages/relay-runtime/store/RelayModernStore.js
 *
 * - Normalization and concurrent access to the store is handled by the
 *   RelayPublishQueue.
 *   https://github.com/facebook/relay/blob/v14.1.0/packages/relay-runtime/store/RelayPublishQueue.js#L69-L79
 *
 * - The RelayModernEnvironment already holds a RelayPublishQueue instance and
 *   would get shared once we add Relay client proper to the app. So it would
 *   be best to access the store through the environment at that time, however
 *   there doesn't apear to be an exposed API to batch multiple updates, which
 *   the publish queue and store do support, so for now we'll side-step the
 *   environment and do the coordination ourselves.
 *   https://github.com/facebook/relay/blob/v14.1.0/packages/relay-runtime/store/RelayModernEnvironment.js
 */

import {
  Disposable,
  ConcreteRequest,
  PayloadData,
  ReaderFragment,
  OperationDescriptor,
  ROOT_TYPE,
  getSelector,
  getFragment,
  getRequest,
  createOperationDescriptor,
  ROOT_ID,
  Environment,
  ConnectionHandler,
  MissingFieldHandler,
} from "relay-runtime";
import { NormalizationFragmentSpread } from "relay-runtime/lib/util/NormalizationNode";
import RelayRecordSource from "relay-runtime/lib/store/RelayRecordSource";
import * as RelayModernRecord from "relay-runtime/lib/store/RelayModernRecord";
import * as RelayResponseNormalizer from "relay-runtime/lib/store/RelayResponseNormalizer";
import {
  OptimisticUpdate,
  PublishQueue,
  RecordMap,
  SingularReaderSelector,
  Snapshot,
  Store,
} from "relay-runtime/lib/store/RelayStoreTypes";
import RelayPublishQueue from "relay-runtime/lib/store/RelayPublishQueue";
import RelayModernStore from "relay-runtime/lib/store/RelayModernStore";

import {
  ApolloCache,
  Cache as ApolloCacheTypes,
  isReference,
  Reference,
  Transaction,
  TypePolicies,
  TypePolicy,
  FieldPolicy,
} from "@apollo/client";
import { StoreObject, addTypenameToDocument } from "@apollo/client/utilities";
import { KeySpecifier } from "@apollo/client/cache/inmemory/policies";
export { TypePolicies };

import invariant from "invariant";

// TODO: In TMP we've added quick-lru, but it's an ESM JS module
//       and annoyingly that's hard to configure with ts-jest. Figure
//       out why we're using quick-lru there.
import LRUCache from "lru-cache";
import {
  transformDocument,
  transformDocumentWithSupermassiveMVS,
  transformSchema,
} from "./relayDocumentUtils";

import type { Schema } from "./vendor/relay-compiler/lib/core/Schema";
import type { DefinitionNode, DocumentNode } from "graphql";
import { HandlerProvider } from "relay-runtime/lib/handlers/RelayDefaultHandlerProvider";

declare global {
  // eslint-disable-next-line no-var
  var __RELAY_DEVTOOLS_HOOK__:
    | undefined
    | {
        registerEnvironment: (environment: Environment) => void;
      };
}

type ReadOptions = Omit<ApolloCacheTypes.DiffOptions, "query">;

type OptimisticTransaction = WeakRef<OptimisticUpdate>[];

type RecordLike = {
  __typename?: string;
  [key: string]: unknown;
};

const handlerProvider: HandlerProvider = (handle) => {
  switch (handle) {
    case "connection":
      return ConnectionHandler;
  }
  invariant(false, "No handler provided for `%s`.", handle);
};

export type EntityReadFunction = (
  args: Record<string, any> | null,
) => StoreObject;

export type RelayApolloCacheMode =
  | "RUNTIME_SCHEMA"
  | "RUNTIME_SUPERMASSIVE"
  | "BUILDTIME";

export class RelayApolloCache extends ApolloCache<RecordMap> {
  private store: Store;
  private usingExternalStore: boolean;
  private transactionStack: (boolean | OptimisticTransaction)[];
  private publishQueue: PublishQueue;
  private optimisticTransactions: Map<string, OptimisticTransaction>;
  private typePolicies: TypePolicies;
  private pessimism?: Map<string, [Snapshot, Disposable]>;
  private schema?: Schema;
  private transformedDocumentCache: WeakMap<
    DocumentNode,
    DocumentNode & { __relay?: any }
  >;
  private debugEnvironment?: Environment;
  private missingFieldHandlers: MissingFieldHandler[];
  private mode: RelayApolloCacheMode;

  constructor(
    options: {
      store?: Store;
      typePolicies?: TypePolicies;
      resultCaching?: boolean;
      resultCacheMaxSize?: number;
      /**
       * Specify this if Relay IR needs to be generated at runtime.
       */
      schema?: DocumentNode;
      mode?: RelayApolloCacheMode;
    } = {},
  ) {
    super();
    this.store = options.store || new RelayModernStore(new RelayRecordSource());
    this.usingExternalStore = !!options.store;
    // this.inTransation = false;
    this.transactionStack = [];
    this.typePolicies = options.typePolicies || {};
    this.missingFieldHandlers = this.typePoliciesToMissingDocumentHandlers(
      this.typePolicies,
    );
    this.publishQueue = new RelayPublishQueue(
      this.store,
      handlerProvider,
      this.getDataID,
    );
    this.optimisticTransactions = new Map();
    this.pessimism =
      options.resultCaching ?? true
        ? options.resultCacheMaxSize === undefined
          ? new Map()
          : (new LRUCache<string, [Snapshot, Disposable]>({
              max: options.resultCacheMaxSize,
              dispose: this.disposeMemoizedSnapshot.bind(this),
            }) as unknown as Map<string, [Snapshot, Disposable]>) // TODO: Define actual default
        : undefined;

    this.getDataID = this.getDataID.bind(this);
    this.schema = options.schema && transformSchema(options.schema);
    this.transformedDocumentCache = new WeakMap();

    this.mode =
      options.mode || (this.schema && "RUNTIME_SCHEMA") || "BUILDTIME";

    const devToolsHook = globalThis.__RELAY_DEVTOOLS_HOOK__;
    if (devToolsHook) {
      this.debugEnvironment = new Environment({
        store: this.store,
        network: {
          execute: () => {
            throw new Error("Not implemented");
          },
        },
      });
      devToolsHook.registerEnvironment(this.debugEnvironment);
    }
  }

  // TODO: This does not handle a Relay plural refs object, which looks like: { __refs: string[] }
  identify(object: RecordLike | Reference): string | undefined {
    if (isReference(object)) {
      return object.__ref;
    }
    return this.getDataID(object as RecordLike, object.__typename);
  }

  // We need to filter duplicate entries out in relayTransformDocuments, so ensure results here
  // always return the same object.
  transformDocument(document: DocumentNode): DocumentNode & { __relay?: any } {
    let result = this.transformedDocumentCache.get(document);
    if (!result) {
      result = addTypenameToDocument(document);
      result = {
        ...document,
        definitions: (document.definitions as DefinitionNode[]).filter(
          uniqueFilter,
        ),
      };
      let taggedNode;
      if (this.mode === "BUILDTIME" && (result as any).__relay) {
        taggedNode = result.__relay;
      } else if (this.mode === "RUNTIME_SCHEMA" && this.schema) {
        taggedNode = transformDocument(
          this.schema,
          result,
          true,
          this.typePolicies,
        );
      } else if (this.mode === "RUNTIME_SUPERMASSIVE") {
        taggedNode = transformDocumentWithSupermassiveMVS(
          result,
          true,
          this.typePolicies,
        );
      }
      (result as any).__relay = taggedNode;

      this.transformedDocumentCache.set(document, result);
      this.transformedDocumentCache.set(result, result);
    }
    return result;
  }

  /****************************************************************************
   * Read/write
   ***************************************************************************/

  read<TData = any, TVariables = any>(
    options: ApolloCacheTypes.ReadOptions<TVariables, TData>,
  ): TData | null {
    return this.readWithRelayIR(
      getRequest(this.getTaggedNode(options.query)),
      options,
    );
  }

  // TODO: This is ignoring rootId, is that ok?
  // TODO: This version only supports 1 level of fragment atm. We would have to recurse into the data to fetch data of other fragments. Do we need this for TMP cases?
  /**
   * In case of partial data, this will still include the missing keys in the
   * result, but with a value of `undefined`.
   */
  private readWithRelayIR<TData = any, TVariables = any>(
    request: ConcreteRequest,
    options: Omit<ApolloCacheTypes.ReadOptions<TVariables, TData>, "query">,
  ): TData | null {
    const snapshot = this.getSnapshot(request, options);
    // TODO: Is knowning that the store only saw the root record good enough?
    if (!options.optimistic && snapshot.seenRecords.size === 1) {
      return null;
    }
    if (snapshot.isMissingData && !options.returnPartialData) {
      return null;
    }
    return snapshot.data as unknown as TData;
  }

  write<TData = any, TVariables = any>(
    options: ApolloCacheTypes.WriteOptions<TData, TVariables>,
  ): Reference | undefined {
    return this.writeWithRelayIR(
      getRequest(this.getTaggedNode(options.query)),
      options,
    );
  }

  // TODO: When is Reference as return type used?
  // TODO: This is ignoring dataId atm
  private writeWithRelayIR<TData = any, TVariables = any>(
    request: ConcreteRequest,
    options: Omit<ApolloCacheTypes.WriteOptions<TData, TVariables>, "query">,
  ): Reference | undefined {
    const operation = createOperationDescriptor(
      request,
      options.variables || {},
      // undefined,
      // options.dataId,
    );

    const selector = operation.root;
    const source = RelayRecordSource.create();
    const record = RelayModernRecord.create(selector.dataID, ROOT_TYPE);
    source.set(selector.dataID, record);
    const relayPayload = RelayResponseNormalizer.normalize(
      source,
      selector,
      options.result as PayloadData,
      {
        getDataID: this.getDataID,
        request: operation.request,
        // FIXME: Enabling this would actually break the possibility to check
        //        if the store is missing any data for a query when using diff.
        //        Seeing as it's only a warning, we can probably live with it
        //        or disable it in the code and patch it.
        //
        // This is to handle @client fields being present in the document, but
        // not in the data. Ideally we figure out a way to only apply this for
        // those @client fields, leaving the check/warning for other fields.
        //
        // treatMissingFieldsAsNull: true,
      },
    );

    if (typeof this.inTransation === "boolean") {
      this.publishQueue.commitPayload(operation, relayPayload);
    } else {
      const updater: OptimisticUpdate = {
        operation,
        payload: relayPayload,
        updater: null,
      };
      this.inTransation.push(createWeakRef(updater));
      this.publishQueue.applyUpdate(updater);
    }

    if (!this.inTransation) {
      this.publishQueue.run();
    }

    return undefined;
  }

  // TODO: When is Reference as return type used?
  // TODO: Can we avoid the query write? I.e. how do we build the fragment ref?
  // TODO: Add test for adding `id` value to data to write
  writeFragment<TData = any, TVariables = any>(
    options: ApolloCacheTypes.WriteFragmentOptions<TData, TVariables>,
  ): Reference | undefined {
    const fragment = getFragment(this.getTaggedNode(options.fragment));
    const id = options.id || ROOT_ID;
    this.writeWithRelayIR(getNodeQuery(fragment, id), {
      ...options,
      result: { node: { ...options.data, id } },
      variables: {
        ...options.variables,
        id,
      },
    });
    return undefined;
  }

  // TODO: This version only supports 1 level of fragment atm. We would have to recurse into the data to fetch data of other fragments. Do we need this for TMP cases?
  // TODO: Can we avoid the query read? I.e. how do we build the fragment ref?
  /**
   * In case of partial data, this will still include the missing keys in the
   * result, but with a value of `undefined`.
   */
  readFragment<FragmentType, TVariables = any>(
    options: ApolloCacheTypes.ReadFragmentOptions<FragmentType, TVariables>,
    optimistic = !!options.optimistic,
  ): FragmentType | null {
    const fragment = getFragment(this.getTaggedNode(options.fragment));
    const id = options.id || ROOT_ID;
    const queryResult = this.readWithRelayIR(
      getNodeQuery(fragment, options.id || ROOT_ID),
      {
        ...options,
        variables: {
          ...options.variables,
          id,
        },
        optimistic,
      },
    ) as any;
    if (!optimistic && queryResult === null) {
      return null;
    }
    const fragmentRef = queryResult.node;

    const fragmentSelector = getSelector(fragment, fragmentRef);
    invariant(
      fragmentSelector.kind === "SingularReaderSelector",
      "Only singular fragments are supported",
    );
    const snapshot = this.store.lookup(
      fragmentSelector as SingularReaderSelector,
    );
    if (snapshot.isMissingData && !options.returnPartialData) {
      return null;
    }
    return snapshot.data as unknown as FragmentType;
  }

  // NOTE: Apollo Client's QueryManager uses this internally to keep track of
  //       ROOT_MUTATIONs, so can't throw here.
  //
  // modify(options: ApolloCacheTypes.ModifyOptions): boolean {
  //   throw new Error("Method not implemented.");
  // }

  /****************************************************************************
   * Data changes
   ***************************************************************************/

  /**
   * NOTE: This version will never return missing field errors.
   */
  diff<TData = any, TVariables = any>(
    options: ApolloCacheTypes.DiffOptions<TData, TVariables>,
  ): ApolloCacheTypes.DiffResult<TData> {
    const snapshot = this.getSnapshot(
      getRequest(this.getTaggedNode(options.query)),
      options,
    );
    return {
      result: snapshot.data as unknown as TData,
      complete: !snapshot.isMissingData,
    };
  }

  // TODO: Data selected by any fragment in a query should trigger notifications for the query.
  watch<TData = any, TVariables = any>(
    options: ApolloCacheTypes.WatchOptions<TData, TVariables>,
  ): () => void {
    const request = getRequest(this.getTaggedNode(options.query));
    const operation = createOperationDescriptor(
      request,
      options.variables || {},
    );
    const cacheIdentifier = getQueryCacheIdentifier(operation);
    const queryResult = getQueryResult(operation, cacheIdentifier);

    const fragmentSelector = getSelector(
      queryResult.fragmentNode,
      queryResult.fragmentRef,
    );
    invariant(
      fragmentSelector.kind === "SingularReaderSelector",
      "Only singular fragments are supported",
    );
    let lastSnapshot = this.store.lookup(
      fragmentSelector as SingularReaderSelector,
    );

    const disposable = this.store.subscribe(lastSnapshot, (nextSnapshot) => {
      options.callback(
        {
          result: nextSnapshot.data as unknown as TData,
          complete: !nextSnapshot.isMissingData,
        },
        lastSnapshot.data === undefined || lastSnapshot.isMissingData
          ? undefined
          : {
              result: lastSnapshot.data as unknown as TData,
              complete: !lastSnapshot.isMissingData,
            },
      );
      lastSnapshot = nextSnapshot;
    });

    return () => {
      disposable.dispose();
    };
  }

  /****************************************************************************
   * Optimistic
   ***************************************************************************/

  removeOptimistic(id: string): void {
    const optimisticTransaction = this.optimisticTransactions.get(id);
    invariant(
      optimisticTransaction,
      "No optimistic transaction exists with id: %s",
      id,
    );
    optimisticTransaction.forEach((updaterRef) => {
      const optimisticUpdate = updaterRef.deref();
      invariant(
        optimisticUpdate,
        "Optimistic update was already released but not removed in transaction with id: %s",
        id,
      );
      this.publishQueue.revertUpdate(optimisticUpdate);
    });
    this.publishQueue.run();
  }

  performTransaction(
    callback: Transaction<RecordMap>,
    optimisticId?: string | null,
  ): void {
    try {
      if (optimisticId) {
        invariant(
          !this.optimisticTransactions.has(optimisticId),
          "An optimistic transaction already exists with id: %s",
          optimisticId,
        );
        const transaction: OptimisticTransaction = [];
        this.optimisticTransactions.set(optimisticId, transaction);
        this.transactionStack.push(transaction);
      } else {
        this.transactionStack.push(true);
      }
      callback(this);
      this.transactionStack.pop();
      if (this.transactionStack.length === 0) {
        this.publishQueue.run();
      }
    } catch (e) {
      // TODO: Do we need to clean the publishQueue in case of exception?
      this.transactionStack = [];
    }
  }

  // TODO: Test nested transactions
  private get inTransation(): boolean | OptimisticTransaction {
    return this.transactionStack[this.transactionStack.length - 1] ?? false;
  }

  /****************************************************************************
   * Serialization
   ***************************************************************************/

  extract(optimistic = false): RecordMap {
    return this.store.getSource(optimistic).toJSON();
  }

  // TODO: Check if we need this for react hot-reloads
  // TODO: Do we need to do cleanups first?
  /**
   * This version does not support restoring when an external store was passed
   * in the constructor, as that might indicate it is owned and used elsewhere
   * and would lead to an inconsistent state if we were to only change this.
   */
  restore(serializedState: RecordMap): ApolloCache<RecordMap> {
    invariant(
      !this.usingExternalStore,
      "Can't restore when using external store, as this could lead to inconsistent state.",
    );
    this.store = new RelayModernStore(
      RelayRecordSource.create(serializedState),
    );
    this.publishQueue = new RelayPublishQueue(this.store, null, this.getDataID);
    return this;
  }

  /****************************************************************************
   * TODO: Unimplemented
   ***************************************************************************/

  // https://github.com/facebook/relay/issues/233#issuecomment-1054489769
  reset(_options?: ApolloCacheTypes.ResetOptions): Promise<void> {
    throw new Error("Method not implemented.");
  }

  evict(_options: ApolloCacheTypes.EvictOptions): boolean {
    throw new Error("Method not implemented.");
  }

  /****************************************************************************
   * Private
   ***************************************************************************/

  private getTaggedNode(document: DocumentNode & { __relay?: any }) {
    const taggedNode = this.transformDocument(document).__relay;
    invariant(
      taggedNode,
      "RelayApolloCache: Expected document to contain Relay IR.",
    );
    return taggedNode;
  }

  private _getSnapshot(
    request: ConcreteRequest,
    options: ReadOptions,
  ): Snapshot {
    const operation = createOperationDescriptor(
      request,
      options.variables || {},
    );
    const target = RelayRecordSource.create();
    this.store.check(operation, {
      handlers: this.missingFieldHandlers,
      getTargetForActor: () => target,
    });
    if (target.size() > 0) {
      this.publishQueue.commitSource(target);
      this.publishQueue.run();
    }
    return this.store.lookup(operation.fragment, options.optimistic);
  }

  /**
   * Memoized version
   */
  private getSnapshot(
    request: ConcreteRequest,
    options: ReadOptions,
  ): Snapshot {
    if (this.pessimism === undefined) {
      return this._getSnapshot(request, options);
    }

    const hash = (request as any).hash;
    invariant(hash !== undefined, "Expected request to have a hash property.");
    const cacheKey = JSON.stringify(
      [
        hash,
        options.variables,
        options.optimistic,
        options.id,
        options.rootId,
      ].filter((x) => x !== undefined),
    );

    const memoizedSnapshot = this.pessimism.get(cacheKey);
    if (memoizedSnapshot) {
      return memoizedSnapshot[0];
    }

    const snapshot = this._getSnapshot(request, options);

    const disposable = this.store.subscribe(snapshot, (nextSnapshot) => {
      this.pessimism!.set(cacheKey, [nextSnapshot, disposable]);
    });
    this.pessimism.set(cacheKey, [snapshot, disposable]);

    return snapshot;
  }

  private disposeMemoizedSnapshot([_, disposable]: [
    Snapshot,
    Disposable,
  ]): void {
    disposable.dispose();
  }

  // TODO:
  //
  //  - Support keyArgs.
  //  - In the future, we want to support returning just the id value,
  //    which we'll do only for types that implement the Node interface.
  //    This to ensure that the same store can be used for client code
  //    that uses react-relay and its `node` based features.
  private getDataID(
    fieldValue: Record<string, unknown>,
    typeName?: string,
  ): string | undefined {
    if (!typeName) {
      return undefined;
    }
    return getDataIDFromKeyFields(
      this.typePolicies[typeName]?.keyFields,
      fieldValue,
      typeName,
    );
  }

  private typePoliciesToMissingDocumentHandlers(
    typePolicies: TypePolicies,
  ): MissingFieldHandler[] {
    const handlers: MissingFieldHandler[] = [
      {
        kind: "linked",
        handle(field, record, argValues) {
          if (
            record != null &&
            record.getType() === ROOT_TYPE &&
            field.name === "node" &&
            argValues.hasOwnProperty("id")
          ) {
            return argValues.id;
          }
          return undefined;
        },
      },
    ];
    for (const [type, typePolicy] of Object.entries(typePolicies)) {
      const typeName = type === "Query" ? ROOT_TYPE : type;
      if (typePolicy.fields) {
        for (const [fieldName, fieldPolicy] of Object.entries(
          typePolicy.fields,
        )) {
          const readFunction =
            fieldPolicy &&
            (
              fieldPolicy as FieldPolicy<any> & {
                readFunction?: EntityReadFunction;
              }
            ).readFunction;
          if (readFunction) {
            handlers.push(
              this.createMissingFieldHandler(typeName, fieldName, readFunction),
            );
          }
        }
      }
    }
    return handlers;
  }

  private createMissingFieldHandler(
    typeName: string,
    fieldName: string,
    readFunction: EntityReadFunction,
  ): MissingFieldHandler {
    return {
      kind: "linked",
      handle: (field, record, argValues) => {
        if (
          record != null &&
          record.getType() === typeName &&
          field.name === fieldName
        ) {
          const obj = readFunction(argValues);
          if (obj) {
            return this.getDataID(obj, obj.__typename);
          }
        }
        return undefined;
      },
    };
  }
}

function getDataIDFromKeyFields(
  keyFields: TypePolicy["keyFields"],
  fieldValue: Record<string, unknown>,
  typeName: string,
): string | undefined {
  if (keyFields === undefined) {
    if (fieldValue.id) {
      return `${typeName}:${fieldValue.id}`;
    } else {
      return undefined;
    }
  } else if (keyFields === false) {
    return undefined;
  } else if (typeof keyFields === "function") {
    const keyFieldsFnResult = keyFields(fieldValue as any, {
      typename: typeName,
      readField: () => {
        throw new Error("Not implemented");
      },
      storeObject: fieldValue as any,
    });
    return getDataIDFromKeyFields(
      typeof keyFieldsFnResult === "string"
        ? [keyFieldsFnResult]
        : keyFieldsFnResult,
      fieldValue,
      typeName,
    );
  }
  return (
    typeName +
    ":" +
    JSON.stringify(
      flattenKeySpecifier(keyFields).reduce<Record<string, unknown>>(
        (acc, keyField) => {
          const value = fieldValue[keyField];
          invariant(
            value,
            "Missing field '%s' while computing key fields",
            keyField,
          );
          acc[keyField] = value;
          return acc;
        },
        {},
      ),
    )
  );
}

function flattenKeySpecifier(keySpecifier: KeySpecifier): string[] {
  return keySpecifier.flatMap((key) =>
    typeof key === "string" ? key : flattenKeySpecifier(key),
  );
}

function createWeakRef<T extends object>(value: T): WeakRef<T> {
  if (typeof WeakRef === "function") {
    return new WeakRef(value);
  }
  return {
    deref() {
      return value;
    },
  } as WeakRef<T>;
}

function getQueryResult(
  operation: OperationDescriptor,
  cacheIdentifier: string,
): {
  cacheIdentifier: string;
  fragmentNode: ReaderFragment;
  fragmentRef: unknown;
  operation: OperationDescriptor;
} {
  const rootFragmentRef = {
    __id: operation.fragment.dataID,
    __fragments: {
      [operation.fragment.node.name]: operation.request.variables,
    },
    __fragmentOwner: operation.request,
  };
  return {
    cacheIdentifier,
    fragmentNode: operation.request.node.fragment,
    fragmentRef: rootFragmentRef,
    operation,
  };
}

function getQueryCacheIdentifier(
  // environment: IEnvironment,
  operation: OperationDescriptor,
  // maybeFetchPolicy: ?FetchPolicy,
  // maybeRenderPolicy: ?RenderPolicy,
  cacheBreaker?: string | number,
): string {
  const fetchPolicy = "fetchPolicy"; // maybeFetchPolicy ?? DEFAULT_FETCH_POLICY;
  const renderPolicy = "full"; // maybeRenderPolicy ?? environment.UNSTABLE_getDefaultRenderPolicy();
  const cacheIdentifier = `${fetchPolicy}-${renderPolicy}-${operation.request.identifier}`;
  if (cacheBreaker != null) {
    return `${cacheIdentifier}-${cacheBreaker}`;
  }
  return cacheIdentifier;
}

// ----

function getNodeQuery(
  fragment: ReaderFragment,
  id: string,
): ConcreteRequest & { hash: string } {
  const v0 = [
      {
        defaultValue: null,
        kind: "LocalArgument",
        name: "id",
      },
    ],
    v1 = [
      {
        kind: "Variable",
        name: "id",
        variableName: "id",
      },
    ];
  return {
    hash: (fragment as any).hash,
    fragment: {
      argumentDefinitions: v0 /*: any*/,
      kind: "Fragment",
      metadata: null,
      name: "CacheTestNodeQuery",
      selections: [
        {
          alias: null,
          args: v1 /*: any*/,
          concreteType: null,
          kind: "LinkedField",
          name: "node",
          plural: false,
          selections: [
            {
              args: null,
              kind: "FragmentSpread",
              name: fragment.name,
            },
          ],
          storageKey: null,
        },
      ],
      type: "Query",
      abstractKey: null,
    },
    kind: "Request",
    operation: {
      argumentDefinitions: v0 /*: any*/,
      kind: "Operation",
      name: "CacheTestNodeQuery",
      selections: [
        {
          alias: null,
          args: v1 /*: any*/,
          concreteType: null,
          kind: "LinkedField",
          name: "node",
          plural: false,
          selections: [
            {
              alias: null,
              args: null,
              kind: "ScalarField",
              name: "__typename",
              storageKey: null,
            },
            {
              alias: null,
              args: null,
              kind: "ScalarField",
              name: "id",
              storageKey: null,
            },
            {
              kind: "FragmentSpread",
              name: fragment.name,
              storageKey: null,
              fragment: fragment,
            } as NormalizationFragmentSpread,
          ],
          storageKey: null,
        },
      ],
    },
    params: {
      // cacheID: "90613d3754cd5400b0b29433387dbb42", // TODO: What does this do specifically?
      id: id, // TODO: Is this actually the id value?
      metadata: {},
      name: "CacheTestNodeQuery",
      operationKind: "query",
      text: null,
      // text:
      // "query CacheTestNodeQuery(\n  $id: ID!\n) {\n  node(id: $id) {\n    __typename\n    ...CacheTestFragment\n    id\n  }\n}\n\nfragment CacheTestFragment on Conversation {\n  id\n  title\n}\n",
    },
  };
}

function uniqueFilter<T>(value: T, index: number, array: T[]) {
  return array.indexOf(value) === index;
}
