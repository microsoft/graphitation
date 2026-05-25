import {
  wrapApolloClientForApolloInspector,
  wrapFragmentMethodsForApolloInspector,
} from "../apollo-inspector-compat";

describe("apollo-inspector Apollo Client compatibility", () => {
  test("routes Apollo 3.13 query execution through the legacy inspector hook", () => {
    const queryInfo: any = {
      observableQuery: { dirty: true, queryId: "1" },
      queryId: "1",
    };
    const concast = {
      promise: Promise.resolve({ data: { viewer: { id: "1" } } }),
      subscribe: jest.fn(() => ({ unsubscribe: jest.fn() })),
    };
    const fetchConcastInfo = { concast, fromLink: true };
    const originalFetchConcastWithInfo = jest.fn(() => fetchConcastInfo);
    const queryManager: any = {
      fetchConcastWithInfo: originalFetchConcastWithInfo,
      queries: new Map([["1", queryInfo]]),
    };

    const cleanup = wrapApolloClientForApolloInspector({ queryManager } as any);
    const legacyFetchQueryObservable = queryManager.fetchQueryObservable;
    queryManager.fetchQueryObservable = jest.fn(function inspectorHook(
      this: any,
      ...args: any[]
    ) {
      return legacyFetchQueryObservable.apply(this, args);
    });

    const options = {
      fetchPolicy: "cache-first",
      query: { definitions: [] },
      variables: { id: "1" },
    };
    const transformedQuery = { definitions: [{ kind: "OperationDefinition" }] };
    const result = queryManager.fetchConcastWithInfo(
      queryInfo,
      options,
      1,
      transformedQuery,
    );

    expect(result).toBe(fetchConcastInfo);
    expect(queryManager.fetchQueryObservable).toHaveBeenCalledWith(
      "1",
      options,
      1,
      transformedQuery,
    );
    expect(originalFetchConcastWithInfo).toHaveBeenCalledWith(
      queryInfo,
      options,
      1,
      transformedQuery,
    );
    expect(queryInfo.shouldNotify()).toBe(true);

    queryManager.fetchQueryObservable = legacyFetchQueryObservable;
    cleanup();

    expect(queryManager.fetchConcastWithInfo).toBe(
      originalFetchConcastWithInfo,
    );
    expect(queryManager.fetchQueryObservable).toBeUndefined();
    expect(queryInfo.shouldNotify).toBeUndefined();
  });

  test("adds shouldNotify to query infos inserted after tracking starts", () => {
    const queryManager: any = {
      fetchConcastWithInfo: jest.fn(),
      queries: new Map(),
    };
    const cleanup = wrapApolloClientForApolloInspector({ queryManager } as any);
    const queryInfo: any = { observableQuery: { dirty: false } };

    queryManager.queries.set("2", queryInfo);

    expect(queryInfo.shouldNotify()).toBe(false);
    queryInfo.observableQuery.dirty = true;
    expect(queryInfo.shouldNotify()).toBe(true);

    cleanup();

    expect(queryInfo.shouldNotify).toBeUndefined();
  });
});

describe("apollo-inspector fragment name compatibility", () => {
  test("derives fragment names before inspector records fragment operations", () => {
    const fragment = {
      definitions: [
        {
          kind: "FragmentDefinition",
          name: { value: "UserFields" },
        },
      ],
    };
    const client: any = {
      cache: {
        readFragment: jest.fn((options) => options.fragmentName),
        writeFragment: jest.fn((options) => options.fragmentName),
      },
      readFragment: jest.fn((options) => options.fragmentName),
      writeFragment: jest.fn((options) => options.fragmentName),
    };
    const originalReadFragment = client.readFragment;

    const cleanup = wrapFragmentMethodsForApolloInspector(client);

    expect(client.readFragment({ fragment })).toBe("UserFields");
    expect(
      client.writeFragment({ fragment, fragmentName: "ExplicitName" }),
    ).toBe("ExplicitName");
    expect(client.cache.readFragment({ fragment })).toBeUndefined();
    expect(client.cache.writeFragment({ fragment })).toBeUndefined();

    cleanup();

    expect(client.readFragment).toBe(originalReadFragment);
  });
});
