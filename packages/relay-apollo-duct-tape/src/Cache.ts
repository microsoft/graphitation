/**
 * BIG TODOs:
 *
 * - Look at using https://github.com/facebook/relay/blob/603bb4bc2927bda8b7f0dac1d86cbc5ecbf50202/packages/relay-runtime/store/RelayReader.js#L100
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

// This is needed for field read functions
const RelayFeatureFlags = require("relay-runtime/lib/util/RelayFeatureFlags");
RelayFeatureFlags.ENABLE_RELAY_RESOLVERS = true;

import {
  ApolloCache,
  Cache as ApolloCacheTypes,
  isReference,
  Reference,
  Transaction,
} from "@apollo/client";
import { addTypenameToDocument } from "@apollo/client/utilities";

import invariant from "invariant";

// TODO: In TMP we've added quick-lru, but it's an ESM JS module
//       and annoyingly that's hard to configure with ts-jest. Figure
//       out why we're using quick-lru there.
import LRUCache from "lru-cache";
import { transformDocument, transformSchema } from "./relayDocumentUtils";

import type { Schema } from "./vendor/relay-compiler/lib/core/Schema";
import type { DocumentNode, DefinitionNode } from "graphql";

declare global {
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

interface TypePolicy {
  keyFields?: string[] | false;
}
export interface TypePolicies {
  [typename: string]: TypePolicy;
}

export class RelayApolloCache extends ApolloCache<RecordMap> {
  private store: Store;
  private usingExternalStore: boolean;
  private transactionStack: (boolean | OptimisticTransaction)[];
  private publishQueue: PublishQueue;
  private optimisticTransactions: Map<string, OptimisticTransaction>;
  private typePolicies: TypePolicies;
  private pessimism?: Map<string, [Snapshot, Disposable]>;
  private schema?: Schema;
  private typenameDocumentCache?: WeakMap<DocumentNode, DocumentNode>;
  private debugEnvironment?: Environment;

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
    } = {},
  ) {
    super();
    this.store = options.store || new RelayModernStore(new RelayRecordSource());
    this.usingExternalStore = !!options.store;
    // this.inTransation = false;
    this.transactionStack = [];
    this.typePolicies = options.typePolicies || {};
    this.publishQueue = new RelayPublishQueue(this.store, null, this.getDataID);
    this.optimisticTransactions = new Map();
    this.pessimism =
      options.resultCaching ?? true
        ? options.resultCacheMaxSize === undefined
          ? new Map()
          : ((new LRUCache<string, [Snapshot, Disposable]>({
              max: options.resultCacheMaxSize,
              dispose: this.disposeMemoizedSnapshot.bind(this),
            }) as unknown) as Map<string, [Snapshot, Disposable]>) // TODO: Define actual default
        : undefined;

    this.getDataID = this.getDataID.bind(this);
    this.schema = options.schema && transformSchema(options.schema);
    if (options.schema) {
      this.typenameDocumentCache = new WeakMap();
    }

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
  transformDocument(document: DocumentNode): DocumentNode {
    if (this.schema) {
      let result = this.typenameDocumentCache!.get(document);
      if (!result) {
        // TODO: Add test with multiple references to the same fragment
        //
        // addTypenameToDocument will create new objects for each definition in the list,
        // this means that even identical dupes will be replaced with new objects and we
        // won't be able to easily dedupe afterwards. RelayParser needs this deduped, so
        // we do this now.
        result = addTypenameToDocument({
          ...document,
          definitions: (document.definitions as DefinitionNode[]).filter(
            uniqueFilter,
          ),
        });
        this.typenameDocumentCache!.set(document, result);
        // If someone calls transformDocument and then mistakenly passes the
        // result back into an API that also calls transformDocument, make sure
        // we don't keep creating new query documents.
        this.typenameDocumentCache!.set(result, result);
      }
      return result;
    }
    return document;
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
    return (snapshot.data as unknown) as TData;
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
      result: { node: { ...options.data, id } },
      variables: options.variables,
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
    const queryResult = this.readWithRelayIR(
      getNodeQuery(fragment, options.id || ROOT_ID),
      {
        ...options,
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
    return (snapshot.data as unknown) as FragmentType;
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
    options: ApolloCacheTypes.DiffOptions,
  ): ApolloCacheTypes.DiffResult<TData> {
    const snapshot = this.getSnapshot(
      getRequest(this.getTaggedNode(options.query)),
      options,
    );
    return {
      result: (snapshot.data as unknown) as TData,
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
          result: (nextSnapshot.data as unknown) as TData,
          complete: !nextSnapshot.isMissingData,
        },
        lastSnapshot.data === undefined || lastSnapshot.isMissingData
          ? undefined
          : {
              result: (lastSnapshot.data as unknown) as TData,
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

  extract(optimistic: boolean = false): RecordMap {
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
  reset(options?: ApolloCacheTypes.ResetOptions): Promise<void> {
    throw new Error("Method not implemented.");
  }

  evict(options: ApolloCacheTypes.EvictOptions): boolean {
    throw new Error("Method not implemented.");
  }

  /****************************************************************************
   * Private
   ***************************************************************************/

  private getTaggedNode(document: DocumentNode & { __relay?: any }) {
    const taggedNode = this.schema
      ? transformDocument(
          this.schema,
          this.transformDocument(document),
          !!this.pessimism,
          this.typePolicies,
        )
      : document.__relay;
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
    const keyFields = this.typePolicies[typeName]?.keyFields;
    if (keyFields === undefined) {
      if (fieldValue.id) {
        return `${typeName}:${fieldValue.id}`;
      } else {
        return undefined;
      }
    } else if (keyFields === false) {
      return undefined;
    }
    return (
      typeName +
      ":" +
      JSON.stringify(
        keyFields.reduce<Record<string, unknown>>((acc, keyField) => {
          const value = fieldValue[keyField];
          invariant(
            value,
            "Missing field '%s' while computing key fields",
            keyField,
          );
          acc[keyField] = value;
          return acc;
        }, {}),
      )
    );
  }
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
  var v0 = [
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
