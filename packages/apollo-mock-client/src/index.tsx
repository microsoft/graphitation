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
  private operations: [
    operation: Operation,
    observer: ZenObservable.SubscriptionObserver<FetchResult>
  ][];

  constructor() {
    this.operations = [];
  }

  public addOperation(
    operation: Operation,
    observer: ZenObservable.SubscriptionObserver<FetchResult>
  ) {
    this.operations.push([operation, observer]);
  }

  // ---

  public getAllOperations(): Operation[] {
    return this.operations.map(([op, _]) => op);
  }

  public getMostRecentOperation(): Operation {
    invariant(
      this.operations.length > 0,
      "Expected at least one operation to have been started"
    );
    const [op, _] = this.operations[this.operations.length - 1];
    return op;
  }

  // ---

  public async nextValue(operation: Operation, data: MockData): Promise<void> {
    const [_, observer] = this.operations[this.findOperationIndex(operation)];
    observer.next(data);
  }

  public async complete(operation: Operation): Promise<void> {
    const index = this.findOperationIndex(operation);
    const [_, observer] = this.operations[index];
    observer.complete();
    this.operations.splice(index, 1);
  }

  public async resolve(operation: Operation, data: MockData): Promise<void> {
    this.nextValue(operation, data);
    this.complete(operation);
  }

  public async reject(operation: Operation, error: Error): Promise<void> {
    const [_, observer] = this.operations[this.findOperationIndex(operation)];
    observer.error(error);
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

  public findOperation(findFn: (operation: Operation) => boolean): Operation {
    const operation = this.operations.find(([op, _]) => findFn(op));
    invariant(
      operation,
      "Operation was not found in the list of pending operations"
    );
    return operation[0];
  }

  // ----

  private findOperationIndex(operation: Operation) {
    const index = this.operations.findIndex(([op, _]) => op === operation);
    invariant(index >= 0, "Expected to find operation");
    return index;
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
