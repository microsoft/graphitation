import {
  ApolloLink,
  Observable,
  Operation,
  FetchResult,
  ApolloClient,
  InMemoryCache,
  NormalizedCacheObject,
  InMemoryCacheConfig,
} from "@apollo/client";
import invariant from "invariant";
import {
  assertType,
  DocumentNode,
  ExecutionResult,
  GraphQLSchema,
  isAbstractType,
} from "graphql";

export interface RequestDescriptor<Node = DocumentNode> {
  readonly node: Node;
  readonly variables: Record<string, any>;
}

export interface OperationDescriptor<
  Schema = GraphQLSchema,
  Node = DocumentNode
> {
  readonly schema: Schema;
  readonly request: RequestDescriptor<Node>;
}

type OperationMockResolver<Schema = GraphQLSchema, Node = DocumentNode> = (
  operation: OperationDescriptor<Schema, Node>,
) => ExecutionResult | Error | undefined | null;

export interface MockFunctions<Schema = GraphQLSchema, Node = DocumentNode> {
  /**
   * Get all operation executed during the test by the current time.
   */
  getAllOperations(): OperationDescriptor<Schema, Node>[];

  /**
   * Return the most recent operation. This method will throw if no operations were executed prior this call.
   */
  getMostRecentOperation(): OperationDescriptor<Schema, Node>;

  /**
   * Find a particular operation in the list of all executed operations. This method will throw if the operation is not
   * found.
   */
  findOperation(
    findFn: (operation: OperationDescriptor<Schema, Node>) => boolean,
  ): OperationDescriptor<Schema, Node>;

  /**
   * Provide a payload for an operation, but not complete the request. Practically useful when testing incremental
   * updates and subscriptions.
   *
   * @note
   *
   * ApolloClient requires a delay until the next tick of the runloop before it updates,
   * as per https://www.apollographql.com/docs/react/development-testing/testing/
   */
  nextValue(
    operation: OperationDescriptor<Schema, Node>,
    data: ExecutionResult,
  ): Promise<void>;

  /**
   * Complete the operation. No more payloads are expected for this operation.
   *
   * @note
   *
   * ApolloClient requires a delay until the next tick of the runloop before it updates,
   * as per https://www.apollographql.com/docs/react/development-testing/testing/
   */
  complete(operation: OperationDescriptor<Schema, Node>): Promise<void>;

  /**
   * Resolve the request with the provided payload. This is a shortcut for `nextValue(...)` and `complete(...)`.
   *
   * @note
   *
   * ApolloClient requires a delay until the next tick of the runloop before it updates,
   * as per https://www.apollographql.com/docs/react/development-testing/testing/
   */
  resolve(
    operation: OperationDescriptor<Schema, Node>,
    data: ExecutionResult,
  ): Promise<void>;

  /**
   * Reject the request with a given error.
   *
   * @note
   *
   * ApolloClient requires a delay until the next tick of the runloop before it updates,
   * as per https://www.apollographql.com/docs/react/development-testing/testing/
   */
  reject(
    operation: OperationDescriptor<Schema, Node>,
    error: Error,
  ): Promise<void>;

  /**
   * A shortcut for `getMostRecentOperation()` and `resolve()`.
   *
   * @note
   *
   * ApolloClient requires a delay until the next tick of the runloop before it updates,
   * as per https://www.apollographql.com/docs/react/development-testing/testing/
   */
  resolveMostRecentOperation(
    resolver: (operation: OperationDescriptor<Schema, Node>) => ExecutionResult,
  ): Promise<void>;

  /**
   * A shortcut for `getMostRecentOperation()` and `reject()`.
   * @note
   *
   * ApolloClient requires a delay until the next tick of the runloop before it updates,
   * as per https://www.apollographql.com/docs/react/development-testing/testing/
   */
  rejectMostRecentOperation(
    error: Error | ((operation: OperationDescriptor<Schema, Node>) => Error),
  ): Promise<void>;

  /**
   * Adds a resolver function that will be used to resolve/reject operations as they appear.
   */
  queueOperationResolver: (
    resolver: OperationMockResolver<Schema, Node>,
  ) => Promise<void>;
}

interface ApolloClientExtension {
  mock: MockFunctions;
  // mockClear: () => void;
}

export interface ApolloMockClient
  extends ApolloClient<NormalizedCacheObject>,
    ApolloClientExtension {}

class MockLink extends ApolloLink {
  public schema: GraphQLSchema;
  public mock: Mock;

  constructor(schema: GraphQLSchema) {
    super();
    this.schema = schema;
    this.mock = new Mock();
  }

  // FIXME: This does't actually work well and is likely due to the client
  //        being in a tainted state.
  // public mockClear() {
  //   this.mock = new Mock();
  // }

  public request(operation: Operation): Observable<FetchResult> | null {
    return new Observable<FetchResult>((observer) => {
      this.mock.addOperation(
        {
          schema: this.schema,
          request: {
            node: operation.query,
            variables: operation.variables || {},
          },
        },
        observer,
      );
    });
  }
}

function executeOperationMockResolver(
  resolver: OperationMockResolver,
  operation: OperationDescriptor,
  observer: ZenObservable.SubscriptionObserver<FetchResult>,
) {
  const resolved = resolver(operation);
  if (resolved) {
    if (resolved instanceof Error) {
      observer.error(resolved);
    } else {
      observer.next(resolved);
    }
    observer.complete();
    return true;
  }
  return false;
}

class Mock implements MockFunctions {
  private operations: Map<
    OperationDescriptor,
    ZenObservable.SubscriptionObserver<FetchResult>
  >;

  private resolversQueue: OperationMockResolver[];

  constructor() {
    this.operations = new Map();
    this.resolversQueue = [];
  }

  public addOperation(
    operation: OperationDescriptor,
    observer: ZenObservable.SubscriptionObserver<FetchResult>,
  ) {
    for (const resolver of this.resolversQueue) {
      if (executeOperationMockResolver(resolver, operation, observer)) {
        return;
      }
    }
    // If not immediately resolved, store it for later
    this.operations.set(operation, observer);
  }

  private getObserver(operation: OperationDescriptor) {
    const observer = this.operations.get(operation);
    invariant(observer, "Could not find operation in execution queue");
    return observer;
  }

  /**
   * MockFunctions
   */

  public getAllOperations(): OperationDescriptor[] {
    return Array.from(this.operations.keys());
  }

  public getMostRecentOperation(): OperationDescriptor {
    const operations = this.getAllOperations();
    invariant(
      operations.length > 0,
      "Expected at least one operation to have been started",
    );
    return operations[operations.length - 1];
  }

  public findOperation(
    findFn: (operation: OperationDescriptor) => boolean,
  ): OperationDescriptor {
    let result: OperationDescriptor | null = null;
    for (const operation of this.operations.keys()) {
      if (findFn(operation)) {
        result = operation;
        break;
      }
    }
    invariant(
      result,
      "Operation was not found in the list of pending operations",
    );
    return result;
  }

  public async nextValue(
    operation: OperationDescriptor,
    data: ExecutionResult,
  ): Promise<void> {
    this.getObserver(operation).next(data);
  }

  public async complete(operation: OperationDescriptor): Promise<void> {
    const observer = this.getObserver(operation);
    observer.complete();
    this.operations.delete(operation);
  }

  public async resolve(
    operation: OperationDescriptor,
    data: ExecutionResult,
  ): Promise<void> {
    this.nextValue(operation, data);
    this.complete(operation);
  }

  public async reject(
    operation: OperationDescriptor,
    error: Error,
  ): Promise<void> {
    this.getObserver(operation).error(error);
    this.complete(operation);
  }

  public async resolveMostRecentOperation(
    resolver: (operation: OperationDescriptor) => ExecutionResult,
  ): Promise<void> {
    const operation = this.getMostRecentOperation();
    this.resolve(operation, resolver(operation));
  }

  public async rejectMostRecentOperation(
    error: Error | ((operation: OperationDescriptor) => Error),
  ): Promise<void> {
    const operation = this.getMostRecentOperation();
    this.reject(
      operation,
      typeof error === "function" ? error(operation) : error,
    );
  }

  public async queueOperationResolver(resolver: OperationMockResolver) {
    this.resolversQueue.push(resolver);
    for (const [operation, observer] of this.operations) {
      if (executeOperationMockResolver(resolver, operation, observer)) {
        this.operations.delete(operation);
      }
    }
  }
}

export function createMockClient(
  schema: GraphQLSchema,
  options?: { cache?: InMemoryCacheConfig }
): ApolloMockClient {
  // Build a list of abstract types and their possible types.
  // TODO: Cache this on the schema?
  const possibleTypes: Record<string, string[]> = {};
  Object.keys(schema.getTypeMap()).forEach((typeName) => {
    const type = schema.getType(typeName);
    assertType(type);
    if (isAbstractType(type)) {
      possibleTypes[typeName] = schema
        .getPossibleTypes(type)
        .map((possibleType) => possibleType.name);
    }
  });

  const link = new MockLink(schema);

  return Object.assign<
    ApolloClient<NormalizedCacheObject>,
    ApolloClientExtension
  >(
    new ApolloClient({
      cache: new InMemoryCache({
        ...options?.cache,
        possibleTypes,
        addTypename: true,
      }),
      link,
    }),
    {
      get mock() {
        return link.mock;
      },
      // mockClear() {
      //   link.mockClear();
      // },
    },
  );
}
