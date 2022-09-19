import type {
  ConcreteRequest,
  PayloadData,
  Variables,
  ReaderFragment,
} from "relay-runtime";
import {
  Environment,
  getRequest,
  createOperationDescriptor,
  ROOT_ID,
} from "relay-runtime";
import { NormalizationFragmentSpread } from "relay-runtime/lib/util/NormalizationNode";
import { getFragmentResourceForEnvironment } from "react-relay/lib/relay-hooks/FragmentResource";

import invariant from "invariant";

import {
  ApolloCache,
  Cache as _Cache,
  Reference,
  Transaction,
} from "@apollo/client";

type TSerialized = unknown;

export class Cache extends ApolloCache<TSerialized> {
  constructor(private environment: Environment) {
    super();
  }

  // ----
  // Required and not yet implemented

  diff<T>(query: _Cache.DiffOptions): _Cache.DiffResult<T> {
    throw new Error("Method not implemented.");
  }

  watch<TData = any, TVariables = any>(
    watch: _Cache.WatchOptions<TData, TVariables>,
  ): () => void {
    throw new Error("Method not implemented.");
  }

  reset(options?: _Cache.ResetOptions): Promise<void> {
    throw new Error("Method not implemented.");
  }

  evict(options: _Cache.EvictOptions): boolean {
    throw new Error("Method not implemented.");
  }

  restore(serializedState: TSerialized): ApolloCache<TSerialized> {
    throw new Error("Method not implemented.");
  }

  removeOptimistic(id: string): void {
    throw new Error("Method not implemented.");
  }

  performTransaction(
    transaction: Transaction<TSerialized>,
    optimisticId?: string | null,
  ): void {
    throw new Error("Method not implemented.");
  }

  // ----
  // Required and implemented

  // TODO: This is ignoring rootId, is that ok?
  read<TData = any, TVariables = any>(
    options: _Cache.ReadOptions<TVariables, TData>,
  ): TData | null {
    const request = getRequest(options.query);
    const operation = createOperationDescriptor(
      request,
      options.variables || {},
    );
    return (this.environment.lookup(operation.fragment)
      .data as unknown) as TData;
  }

  // TODO: When is Reference as return type used?
  // TODO: This is ignoring dataId, is that ok?
  write<TData = any, TVariables = any>(
    options: _Cache.WriteOptions<TData, TVariables>,
  ): Reference | undefined {
    const request = getRequest(options.query);
    const operation = createOperationDescriptor(
      request,
      options.variables || {},
    );
    this.environment.commitPayload(operation, options.result as PayloadData);
    return undefined;
  }

  // TODO: Unsure if we really would want this as the shape is different,
  //       but for now, for testing purposes, it's here.
  // TODO: Ignoring optimistic param atm
  extract(optimistic?: boolean): TSerialized {
    return this.environment.getStore().getSource().toJSON();
  }

  // ----
  // Not required, overrides

  // TODO: When is Reference as return type used?
  writeFragment<TData = any, TVariables = any>(
    options: _Cache.WriteFragmentOptions<TData, TVariables>,
  ): undefined {
    this.write({
      query: getNodeQuery(options.fragment, options.id || ROOT_ID),
      result: { node: options.data },
      variables: options.variables,
    });
    return undefined;
  }

  // TODO: This version only supports 1 level of fragment atm. We would have to recurse into the data to fetch data of other fragments. Do we need this for TMP cases?
  // TODO: Ignoring optimistic param atm
  readFragment<FragmentType, TVariables = any>(
    options: _Cache.ReadFragmentOptions<FragmentType, TVariables>,
    optimistic?: boolean,
  ): FragmentType | null {
    const x = this.read({
      ...options,
      query: getNodeQuery(options.fragment, options.id || ROOT_ID),
      optimistic: false,
    }) as any;
    const fragmentRef = x.node;

    // https://github.com/facebook/relay/blob/1ca25c1b44ae7b18f9c021a13a64ef50cf5999b9/packages/react-relay/relay-hooks/useFragmentNode.js#L41-L46
    // https://github.com/facebook/relay/blob/1ca25c1b44ae7b18f9c021a13a64ef50cf5999b9/packages/react-relay/relay-hooks/FragmentResource.js#L211-L216
    const FragmentResource = getFragmentResourceForEnvironment(
      this.environment,
    );
    const fragmentResult = FragmentResource.read(
      options.fragment,
      fragmentRef,
      "useFragment()",
    );

    // TODO: Handle missing data
    invariant(
      fragmentResult.data !== undefined && !fragmentResult.isMissingData,
      "Missing data!",
    );

    return fragmentResult.data as FragmentType;
  }
}

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
