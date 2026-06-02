import { ApolloClient, ApolloLink, gql, Observable } from "@apollo/client";
import { ApolloInspector, OperationType } from "@pavelglac/apollo-inspector";
import type { OperationDefinitionNode } from "graphql";
import { ForestRun } from "@graphitation/apollo-forest-run";

const TEST_CLIENT_ID = "test-client";

const QUERY_DOCUMENT = gql`
  query TestQuery {
    viewer {
      id
      name
      __typename
    }
  }
`;

const MUTATION_DOCUMENT = gql`
  mutation UpdateViewer($name: String!) {
    updateViewer(name: $name) {
      id
      name
      __typename
    }
  }
`;

const SUBSCRIPTION_DOCUMENT = gql`
  subscription ViewerUpdated {
    viewerUpdated {
      id
      name
      __typename
    }
  }
`;

const FRAGMENT_DOCUMENT = gql`
  fragment ViewerFields on Viewer {
    id
    name
    __typename
  }
`;

const VIEWER_ID = "Viewer:1";

describe("Apollo operations tracker", () => {
  const originalWindow = (globalThis as { window?: typeof globalThis }).window;
  let consoleLogSpy: jest.SpyInstance;

  beforeAll(() => {
    (globalThis as { window?: typeof globalThis }).window = globalThis;
  });

  afterAll(() => {
    if (originalWindow) {
      (globalThis as { window?: typeof globalThis }).window = originalWindow;
      return;
    }

    delete (globalThis as { window?: typeof globalThis }).window;
  });

  beforeEach(() => {
    consoleLogSpy = jest.spyOn(console, "log").mockImplementation(() => {});
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
  });

  it.each([
    OperationType.Query,
    OperationType.Mutation,
    OperationType.Subscription,
    OperationType.ClientWriteQuery,
    OperationType.ClientReadQuery,
    OperationType.ClientWriteFragment,
    OperationType.ClientReadFragment,
    OperationType.CacheWriteQuery,
    OperationType.CacheReadQuery,
    OperationType.CacheWriteFragment,
    OperationType.CacheReadFragment,
  ])("tracks %s operations", async (operationType) => {
    const operations = await recordOperations();

    expect(
      operations.find((operation) => operation.operationType === operationType),
    ).toMatchObject({
      operationType,
      status: "Succeded",
    });
  });
});

async function recordOperations() {
  const cache = new ForestRun({ addTypename: true, resultCaching: false });
  const client = new ApolloClient({
    cache: cache as any,
    link: new ApolloLink((operation) => {
      const definition = operation.query.definitions.find(
        (node): node is OperationDefinitionNode =>
          node.kind === "OperationDefinition",
      );

      return new Observable((observer) => {
        switch (definition?.operation) {
          case "query":
            observer.next({
              data: {
                viewer: {
                  __typename: "Viewer",
                  id: "1",
                  name: "Ada",
                },
              },
            });
            observer.complete();
            break;
          case "mutation":
            observer.next({
              data: {
                updateViewer: {
                  __typename: "Viewer",
                  id: "1",
                  name: operation.variables.name,
                },
              },
            });
            observer.complete();
            break;
          case "subscription":
            observer.next({
              data: {
                viewerUpdated: {
                  __typename: "Viewer",
                  id: "1",
                  name: "Grace",
                },
              },
            });
            break;
          default:
            observer.error(new Error("Unsupported operation"));
        }
      });
    }),
  });
  const inspector = new ApolloInspector([
    {
      client: client as any,
      clientId: TEST_CLIENT_ID,
    },
  ]);
  const stopTracking = inspector.startTracking({
    tracking: { trackVerboseOperations: true },
    apolloClientIds: [TEST_CLIENT_ID],
  });

  let querySubscription:
    | {
        unsubscribe(): void;
      }
    | undefined;
  await new Promise<void>((resolve, reject) => {
    const observableQuery = client.watchQuery({
      query: QUERY_DOCUMENT,
      fetchPolicy: "network-only",
    });

    querySubscription = observableQuery.subscribe({
      next: () => {
        resolve();
      },
      error: reject,
    });
  });

  await client.mutate({
    mutation: MUTATION_DOCUMENT,
    variables: { name: "Grace" },
  });

  await new Promise<void>((resolve, reject) => {
    const subscription = client.subscribe({
      query: SUBSCRIPTION_DOCUMENT,
    });

    const observer = subscription.subscribe({
      next: () => {
        observer.unsubscribe();
        resolve();
      },
      error: reject,
    });
  });

  client.writeQuery({
    query: QUERY_DOCUMENT,
    data: {
      viewer: {
        __typename: "Viewer",
        id: "1",
        name: "Marie",
      },
    },
  });
  client.readQuery({ query: QUERY_DOCUMENT });

  client.writeFragment({
    id: VIEWER_ID,
    fragment: FRAGMENT_DOCUMENT,
    fragmentName: "ViewerFields",
    data: {
      __typename: "Viewer",
      id: "1",
      name: "Linus",
    },
  });
  client.readFragment({
    id: VIEWER_ID,
    fragment: FRAGMENT_DOCUMENT,
    fragmentName: "ViewerFields",
  });

  cache.writeQuery({
    query: QUERY_DOCUMENT,
    data: {
      viewer: {
        __typename: "Viewer",
        id: "1",
        name: "Ken",
      },
    },
  });
  cache.readQuery({ query: QUERY_DOCUMENT });

  cache.writeFragment({
    id: VIEWER_ID,
    fragment: FRAGMENT_DOCUMENT,
    fragmentName: "ViewerFields",
    data: {
      __typename: "Viewer",
      id: "1",
      name: "Matz",
    },
  });
  cache.readFragment({
    id: VIEWER_ID,
    fragment: FRAGMENT_DOCUMENT,
    fragmentName: "ViewerFields",
  });

  const operations = stopTracking().operations ?? [];
  querySubscription?.unsubscribe();
  return operations;
}
