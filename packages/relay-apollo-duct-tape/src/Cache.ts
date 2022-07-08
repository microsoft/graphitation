import type {
  ConcreteRequest,
  SelectorData,
  PayloadData,
  Variables,
  ReaderFragment,
} from "relay-runtime";
import {
  Environment,
  getRequest,
  createOperationDescriptor,
} from "relay-runtime";
import { NormalizationFragmentSpread } from "relay-runtime/lib/util/NormalizationNode";
import { getFragmentResourceForEnvironment } from "react-relay/lib/relay-hooks/FragmentResource";

import invariant from "invariant";

// import { ApolloCache } from "@apollo/client";
// export class Cache extends ApolloCache<unknown> {

export class Cache {
  constructor(private environment: Environment) {}

  writeQuery(options: {
    query: ConcreteRequest;
    data: PayloadData;
    variables?: Variables;
  }) {
    const request = getRequest(options.query);
    const operation = createOperationDescriptor(
      request,
      options.variables || {},
    );
    this.environment.commitPayload(operation, options.data);
  }

  readQuery(options: { query: ConcreteRequest; variables?: Variables }) {
    const request = getRequest(options.query);
    const operation = createOperationDescriptor(
      request,
      options.variables || {},
    );
    return this.environment.lookup(operation.fragment).data;
  }

  writeFragment(options: {
    id: string;
    fragment: ReaderFragment;
    data: SelectorData;
    variables?: Variables;
  }) {
    this.writeQuery({
      query: getNodeQuery(options.fragment, options.id),
      data: { node: options.data },
      variables: options.variables,
    });
  }

  /**
   * TODO: This version only supports 1 level of fragment atm. We would have to recurse into the data to fetch data of other fragments. Do we need this for TMP cases?
   */
  readFragment(options: {
    id: string;
    fragment: ReaderFragment;
    variables?: Variables;
  }) {
    const x = this.readQuery({
      query: getNodeQuery(options.fragment, options.id),
      variables: options.variables,
    });
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

    return fragmentResult.data;
  }

  // TODO: Unsure if we really would want this as the shape is different,
  //       but for now, for testing purposes, it's here.
  extract() {
    return this.environment.getStore().getSource().toJSON();
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
