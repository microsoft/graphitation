/* eslint-disable max-classes-per-file */
import * as React from "react";
import {
  ApolloLink,
  Observable,
  Operation,
  NextLink,
  FetchResult,
  ApolloClient,
  InMemoryCache,
  ApolloProvider,
} from "@apollo/client";
import invariant from "invariant";
import { assertType, GraphQLSchema, isAbstractType } from "graphql";

class MockLink extends ApolloLink {
  constructor(private environment: MockEnvironment) {
    super();
  }

  public request(operation: Operation): Observable<FetchResult> | null {
    operation.setContext({ schema: this.environment.schema });
    return new Observable<FetchResult>((observer) => {
      this.environment.addOperation(operation, observer);
    });
  }
}

// interface MockOperation {
//   resolve();
// }

// An opaque type that internally holds an Apollo Client Operation, but that should not be exposed to the user.
type OperationDescriptor = { __brand: "OperationDescriptor" };

type MockData = Record<string, unknown>;

class MockEnvironment {
  private operations: [
    operation: Operation,
    observer: ZenObservable.SubscriptionObserver<FetchResult>
  ][];

  // TODO: This should remain file private
  public schema: GraphQLSchema;

  constructor(schema: GraphQLSchema) {
    this.operations = [];
    this.schema = schema;
  }

  // TODO: This should remain file private
  public addOperation(
    operation: Operation,
    observer: ZenObservable.SubscriptionObserver<FetchResult>
  ) {
    this.operations.push([operation, observer]);
  }

  // ---

  public getMostRecentOperation(): OperationDescriptor {
    invariant(
      this.operations.length > 0,
      "Expected at least one operation to have been started"
    );
    const [op, _] = this.operations[this.operations.length - 1];
    return (op as unknown) as OperationDescriptor;
  }

  // ---

  public nextValue(operation: OperationDescriptor, data: MockData): void {
    const [_, observer] = this.operations[this.findOperationIndex(operation)];
    observer.next(data);
  }

  // TODO: Does this need to do more work, such as finish the observable?
  public complete(operation: OperationDescriptor): void {
    const index = this.findOperationIndex(operation);
    const [_, observer] = this.operations[index];
    observer.complete();
    this.operations.splice(index, 1);
  }

  public resolve(operation: OperationDescriptor, data: MockData): void {
    this.nextValue(operation, data);
    this.complete(operation);
  }

  public reject(operation: OperationDescriptor, error: Error): void {}

  public resolveMostRecentOperation(
    resolver: (operation: OperationDescriptor) => MockData
  ): void {
    const operation = this.getMostRecentOperation();
    this.resolve(operation, resolver(operation));
  }

  public rejectMostRecentOperation(
    resolve: (operation: OperationDescriptor) => Error
  ): void {}

  // ----

  private findOperationIndex(operation: OperationDescriptor) {
    const index = this.operations.findIndex(
      ([op, _]) => op === ((operation as unknown) as Operation)
    );
    invariant(index >= 0, "Expected to find operation");
    return index;
  }
}

export function createMockEnvironment(schema: GraphQLSchema) {
  const env = new MockEnvironment(schema);
  return env;
}

export const ApolloMockProvider: React.FC<{
  environment: MockEnvironment;
}> = ({ children, environment }) => {
  // Build a list of abstract types and their possible types.
  // TODO: Cache this on the schema?
  const schema = environment.schema;
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

  const client = new ApolloClient({
    cache: new InMemoryCache({
      possibleTypes,
      addTypename: false,
    }),
    link: new MockLink(environment),
  });

  return <ApolloProvider client={client}>{children}</ApolloProvider>;
};
