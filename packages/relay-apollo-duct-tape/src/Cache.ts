/**
 * BIG TODOs:
 *
 * - Make type-policies key-fields work
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
  ConcreteRequest,
  PayloadData,
  ReaderFragment,
  OperationDescriptor,
  ROOT_TYPE,
  getSelector,
} from "relay-runtime";
import { getRequest, createOperationDescriptor, ROOT_ID } from "relay-runtime";
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
  Reference,
  Transaction,
} from "@apollo/client";

import invariant from "invariant";

type OptimisticTransaction = WeakRef<OptimisticUpdate>[];

export class RelayApolloCache extends ApolloCache<RecordMap> {
  private store: Store;
  private usingExternalStore: boolean;
  private inTransation: boolean | OptimisticTransaction;
  private publishQueue: PublishQueue;
  private optimisticTransactions: Map<string, OptimisticTransaction>;

  constructor(store?: Store) {
    super();
    this.store = store || new RelayModernStore(new RelayRecordSource());
    this.usingExternalStore = !!store;
    this.inTransation = false;
    this.publishQueue = new RelayPublishQueue(this.store, null, getDataID);
    this.optimisticTransactions = new Map();
  }

  /****************************************************************************
   * Read/write
   ***************************************************************************/

  // TODO: This is ignoring rootId, is that ok?
  // TODO: This version only supports 1 level of fragment atm. We would have to recurse into the data to fetch data of other fragments. Do we need this for TMP cases?
  /**
   * In case of partial data, this will still include the missing keys in the
   * result, but with a value of `undefined`.
   */
  read<TData = any, TVariables = any>(
    options: ApolloCacheTypes.ReadOptions<TVariables, TData>,
  ): TData | null {
    const snapshot = this.getSnapshot(options);
    // TODO: Is knowning that the store only saw the root record good enough?
    if (!options.optimistic && snapshot.seenRecords.size === 1) {
      return null;
    }
    if (snapshot.isMissingData && !options.returnPartialData) {
      return null;
    }
    return (snapshot.data as unknown) as TData;
  }

  // TODO: When is Reference as return type used?
  // TODO: This is ignoring dataId, is that ok?
  write<TData = any, TVariables = any>(
    options: ApolloCacheTypes.WriteOptions<TData, TVariables>,
  ): Reference | undefined {
    const request = getRequest(options.query);
    const operation = createOperationDescriptor(
      request,
      options.variables || {},
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
        getDataID,
        request: operation.request,
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
  writeFragment<TData = any, TVariables = any>(
    options: ApolloCacheTypes.WriteFragmentOptions<TData, TVariables>,
  ): Reference | undefined {
    this.write({
      query: getNodeQuery(options.fragment, options.id || ROOT_ID),
      result: { node: options.data },
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
    const queryResult = this.read({
      ...options,
      query: getNodeQuery(options.fragment, options.id || ROOT_ID),
      optimistic,
    }) as any;
    if (!optimistic && queryResult === null) {
      return null;
    }
    const fragmentRef = queryResult.node;

    const fragmentSelector = getSelector(options.fragment, fragmentRef);
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

  /****************************************************************************
   * Data changes
   ***************************************************************************/

  /**
   * NOTE: This version will never return missing field errors.
   */
  diff<TData = any, TVariables = any>(
    options: ApolloCacheTypes.DiffOptions,
  ): ApolloCacheTypes.DiffResult<TData> {
    const snapshot = this.getSnapshot(options);
    return {
      result: (snapshot.data as unknown) as TData,
      complete: !snapshot.isMissingData,
    };
  }

  // TODO: Data selected by any fragment in a query should trigger notifications for the query.
  watch<TData = any, TVariables = any>(
    options: ApolloCacheTypes.WatchOptions<TData, TVariables>,
  ): () => void {
    const operation = createOperationDescriptor(
      options.query,
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
        { result: (nextSnapshot.data as unknown) as TData },
        lastSnapshot.data === undefined || lastSnapshot.isMissingData
          ? undefined
          : { result: (lastSnapshot.data as unknown) as TData },
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
    invariant(!this.inTransation, "Already in a transaction");
    try {
      if (optimisticId) {
        invariant(
          !this.optimisticTransactions.has(optimisticId),
          "An optimistic transaction already exists with id: %s",
          optimisticId,
        );
        const transaction: OptimisticTransaction = [];
        this.optimisticTransactions.set(optimisticId, transaction);
        this.inTransation = transaction;
      } else {
        this.inTransation = true;
      }
      callback(this);
      this.publishQueue.run();
    } finally {
      // TODO: Do we need to clean the publishQueue in case of exception?
      this.inTransation = false;
    }
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
    this.publishQueue = new RelayPublishQueue(this.store, null, getDataID);
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

  private getSnapshot(options: ApolloCacheTypes.DiffOptions): Snapshot {
    const request = getRequest(options.query);
    const operation = createOperationDescriptor(
      request,
      options.variables || {},
    );
    return this.store.lookup(operation.fragment, options.optimistic);
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

function getDataID(
  fieldValue: Record<string, unknown>,
  typeName: string,
): unknown {
  // if (typeName === VIEWER_TYPE) {
  //   // $FlowFixMe[prop-missing]
  //   return fieldValue.id == null ? VIEWER_ID : fieldValue.id;
  // }
  // $FlowFixMe[prop-missing]
  return fieldValue.id;
}

// ----

function getNodeQuery(fragment: ReaderFragment, id: string): ConcreteRequest {
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
