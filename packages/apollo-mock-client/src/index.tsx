import * as React from "react";
import {
  ApolloLink,
  Observable,
  Operation,
  FetchResult,
  ApolloClient,
  InMemoryCache,
  NormalizedCacheObject,
} from "@apollo/client";
import invariant from "invariant";
import { assertType, GraphQLSchema, isAbstractType } from "graphql";

type MockData = Record<string, unknown>;

interface MockFunctions {
  getAllOperations(): Operation[];
  getMostRecentOperation(): Operation;
  findOperation(findFn: (operation: Operation) => boolean): Operation;
  /**
   * @note
   *
   * ApolloClient requires a delay until the next tick of the runloop before it updates,
   * as per https://www.apollographql.com/docs/react/development-testing/testing/
   */
  nextValue(operation: Operation, data: MockData): Promise<void>;
  /**
   * @note
   *
   * ApolloClient requires a delay until the next tick of the runloop before it updates,
   * as per https://www.apollographql.com/docs/react/development-testing/testing/
   */
  complete(operation: Operation): Promise<void>;
  /**
   * @note
   *
   * ApolloClient requires a delay until the next tick of the runloop before it updates,
   * as per https://www.apollographql.com/docs/react/development-testing/testing/
   */
  resolve(operation: Operation, data: MockData): Promise<void>;
  /**
   * @note
   *
   * ApolloClient requires a delay until the next tick of the runloop before it updates,
   * as per https://www.apollographql.com/docs/react/development-testing/testing/
   */
  reject(operation: Operation, error: Error): Promise<void>;
  /**
   * @note
   *
   * ApolloClient requires a delay until the next tick of the runloop before it updates,
   * as per https://www.apollographql.com/docs/react/development-testing/testing/
   */
  resolveMostRecentOperation(
    resolver: (operation: Operation) => MockData
  ): Promise<void>;
  /**
   * @note
   *
   * ApolloClient requires a delay until the next tick of the runloop before it updates,
   * as per https://www.apollographql.com/docs/react/development-testing/testing/
   */
  rejectMostRecentOperation(
    error: Error | ((operation: Operation) => Error)
  ): Promise<void>;
}

interface ApolloClientExtension {
  mock: MockFunctions;
  mockClear: () => void;
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

  public mockClear() {
    this.mock = new Mock();
  }

  public request(operation: Operation): Observable<FetchResult> | null {
    operation.setContext({ schema: this.schema });
    return new Observable<FetchResult>((observer) => {
      this.mock.addOperation(operation, observer);
    });
  }
}

class Mock implements MockFunctions {
  private operations: Map<
    Operation,
    ZenObservable.SubscriptionObserver<FetchResult>
  >;

  constructor() {
    this.operations = new Map();
  }

  public addOperation(
    operation: Operation,
    observer: ZenObservable.SubscriptionObserver<FetchResult>
  ) {
    this.operations.set(operation, observer);
  }

  private getObserver(operation: Operation) {
    const observer = this.operations.get(operation);
    invariant(observer, "Could not find operation in execution queue");
    return observer;
  }

  /**
   * MockFunctions
   */

  public getAllOperations(): Operation[] {
    return Array.from(this.operations.keys());
  }

  public getMostRecentOperation(): Operation {
    const operations = this.getAllOperations();
    invariant(
      operations.length > 0,
      "Expected at least one operation to have been started"
    );
    return operations[operations.length - 1];
  }

  public findOperation(findFn: (operation: Operation) => boolean): Operation {
    let result: Operation | null = null;
    for (const operation of this.operations.keys()) {
      if (findFn(operation)) {
        result = operation;
        break;
      }
    }
    invariant(
      result,
      "Operation was not found in the list of pending operations"
    );
    return result;
  }

  public async nextValue(operation: Operation, data: MockData): Promise<void> {
    this.getObserver(operation).next(data);
  }

  public async complete(operation: Operation): Promise<void> {
    const observer = this.getObserver(operation);
    observer.complete();
    this.operations.delete(operation);
  }

  public async resolve(operation: Operation, data: MockData): Promise<void> {
    this.nextValue(operation, data);
    this.complete(operation);
  }

  public async reject(operation: Operation, error: Error): Promise<void> {
    this.getObserver(operation).error(error);
    this.complete(operation);
  }

  public async resolveMostRecentOperation(
    resolver: (operation: Operation) => MockData
  ): Promise<void> {
    const operation = this.getMostRecentOperation();
    this.resolve(operation, resolver(operation));
  }

  public async rejectMostRecentOperation(
    error: Error | ((operation: Operation) => Error)
  ): Promise<void> {
    const operation = this.getMostRecentOperation();
    this.reject(
      operation,
      typeof error === "function" ? error(operation) : error
    );
  }
}

export function createMockClient(schema: GraphQLSchema): ApolloMockClient {
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
        possibleTypes,
        addTypename: false,
      }),
      link,
    }),
    {
      get mock() {
        return link.mock;
      },
      mockClear() {
        link.mockClear();
      },
    }
  );
}
