import * as React from "react";
import {
  ApolloLink,
  Observable,
  Operation,
  FetchResult,
  ApolloClient,
  InMemoryCache,
  ApolloProvider,
  NormalizedCacheObject,
} from "@apollo/client";
import invariant from "invariant";
import { assertType, GraphQLSchema, isAbstractType } from "graphql";

type MockData = Record<string, unknown>;

interface MockFunctions {
  getAllOperations(): Operation[];
  getMostRecentOperation(): Operation;
  findOperation(findFn: (operation: Operation) => boolean): Operation;
  nextValue(operation: Operation, data: MockData): void;
  complete(operation: Operation): void;
  resolve(operation: Operation, data: MockData): void;
  reject(operation: Operation, error: Error): void;
  resolveMostRecentOperation(
    resolver: (operation: Operation) => MockData
  ): void;
  rejectMostRecentOperation(
    error: Error | ((operation: Operation) => Error)
  ): void;
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
  public mock: _MockEnvironment;

  constructor(schema: GraphQLSchema) {
    super();
    this.schema = schema;
    this.mock = new _MockEnvironment();
  }

  public mockClear() {
    this.mock = new _MockEnvironment();
  }

  public request(operation: Operation): Observable<FetchResult> | null {
    operation.setContext({ schema: this.schema });
    return new Observable<FetchResult>((observer) => {
      this.mock.addOperation(operation, observer);
    });
  }
}

class _MockEnvironment implements MockFunctions {
  private operations: [
    operation: Operation,
    observer: ZenObservable.SubscriptionObserver<FetchResult>
  ][];

  constructor() {
    this.operations = [];
  }

  // TODO: This should remain file private
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

  public nextValue(operation: Operation, data: MockData): void {
    const [_, observer] = this.operations[this.findOperationIndex(operation)];
    observer.next(data);
  }

  public complete(operation: Operation): void {
    const index = this.findOperationIndex(operation);
    const [_, observer] = this.operations[index];
    observer.complete();
    this.operations.splice(index, 1);
  }

  public resolve(operation: Operation, data: MockData): void {
    this.nextValue(operation, data);
    this.complete(operation);
  }

  public reject(operation: Operation, error: Error): void {
    const [_, observer] = this.operations[this.findOperationIndex(operation)];
    observer.error(error);
    this.complete(operation);
  }

  public resolveMostRecentOperation(
    resolver: (operation: Operation) => MockData
  ): void {
    const operation = this.getMostRecentOperation();
    this.resolve(operation, resolver(operation));
  }

  public rejectMostRecentOperation(
    error: Error | ((operation: Operation) => Error)
  ): void {
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

  const ext: ApolloClientExtension = {
    get mock() {
      return link.mock;
    },
    mockClear() {
      link.mockClear();
    },
  };

  const client = new ApolloClient({
    cache: new InMemoryCache({
      possibleTypes,
      addTypename: false,
    }),
    link,
  }) as ApolloMockClient;

  // Object.defineProperties(client, {
  //   mock: {
  //     get() {
  //       return link.mock;
  //     },
  //   },
  //   mockClear: {
  //     value: () => link.mockClear(),
  //   },
  // });

  return Object.assign(client, ext);
}

// export const ApolloMockProvider: React.FC<{
//   environment: MockEnvironment;
// }> = ({ children, environment }) => {
//   // Build a list of abstract types and their possible types.
//   // TODO: Cache this on the schema?
//   const schema = (environment as _MockEnvironment).schema;
//   const possibleTypes: Record<string, string[]> = {};
//   Object.keys(schema.getTypeMap()).forEach((typeName) => {
//     const type = schema.getType(typeName);
//     assertType(type);
//     if (isAbstractType(type)) {
//       possibleTypes[typeName] = schema
//         .getPossibleTypes(type)
//         .map((possibleType) => possibleType.name);
//     }
//   });

//   const client = new ApolloClient({
//     cache: new InMemoryCache({
//       possibleTypes,
//       addTypename: false,
//     }),
//     link: new MockLink(environment as _MockEnvironment),
//   });

//   return <ApolloProvider client={client}>{children}</ApolloProvider>;
// };
