import { parse } from "graphql";
import { describeDocument } from "../document";

describe(describeDocument, () => {
  it("throws an error if the document has no operation definitions", () => {
    const document = parse(`
      fragment Foo on Query {
        field
      }
    `);
    expect(() => describeDocument(document)).toThrowError(
      "Must contain a query definition.",
    );
  });

  it("throws an error if the document has multiple operation definitions", () => {
    // Note: technically this is supported by the spec, but not Apollo
    const document = parse(`
      query Query1 {
        field1
      }
      mutation Mutation1 {
        field2
      }
    `);
    expect(() => describeDocument(document)).toThrowError(
      "Expecting exactly one operation definition, got 2 operations: Query1,Mutation1",
    );
  });

  it("parses a document with a single named operation definition", () => {
    const document = parse(`
      query MyQuery {
        field
      }
    `);
    const descriptor = describeDocument(document);
    expect(descriptor.debugName).toBe("query MyQuery");
    expect(descriptor.definition.name?.value).toBe("MyQuery");
    expect(descriptor.fragmentMap.size).toBe(0);
  });

  it("parses a document with a single unnamed operation definition", () => {
    const document = parse(`
      query {
        field
      }
    `);
    const descriptor = describeDocument(document);
    expect(descriptor.debugName).toBe(`query {\n  field\n}`);
    expect(descriptor.definition.name).toBeUndefined();
    expect(descriptor.fragmentMap.size).toBe(0);
  });

  it("parses a document with operation and fragments", () => {
    const document = parse(`
      query MyQuery {
        ...MyFragment
      }
      fragment MyFragment on Query {
        field
      }
    `);
    const descriptor = describeDocument(document);
    expect(descriptor.debugName).toBe("query MyQuery");
    expect(descriptor.definition.name?.value).toBe("MyQuery");
    expect(descriptor.fragmentMap.size).toBe(1);
    expect(descriptor.fragmentMap.has("MyFragment")).toBe(true);
  });

  it("generates debugName correctly with various selections", () => {
    const document = parse(`
      query {
        field
        ...MyFragment
        ... on Type {
          otherField
        }
      }
      fragment MyFragment on Query {
        fragmentField
      }
    `);
    const descriptor = describeDocument(document);
    expect(descriptor.debugName).toBe(
      `query {\n  field\n  ...MyFragment\n  ... on Type {...}\n}`,
    );
    expect(descriptor.definition.name).toBeUndefined();
    expect(descriptor.fragmentMap.size).toBe(1);
  });

  it("generates debugName correctly for complex selection sets", () => {
    const document = parse(`
      mutation {
        field1
        field2 {
          subField
        }
        ... on Type {
          field3
        }
      }
    `);
    const descriptor = describeDocument(document);
    expect(descriptor.debugName).toBe(
      `mutation {\n  field1\n  field2 {...}\n  ... on Type {...}\n}`,
    );
  });

  it("throws an error if the document contains only fragments", () => {
    const document = parse(`
      fragment MyFragment on Query {
        field
      }
      fragment AnotherFragment on Query {
        anotherField
      }
    `);
    expect(() => describeDocument(document)).toThrowError(
      "Must contain a query definition.",
    );
  });

  it("handles inline fragments without type conditions in debugName", () => {
    const document = parse(`
      query {
        field
        ... {
          subField
        }
      }
    `);
    const descriptor = describeDocument(document);
    expect(descriptor.debugName).toBe(`query {\n  field\n  ... {...}\n}`);
  });

  it("includes aliased fields in debugName", () => {
    const document = parse(`
      query {
        aliasField: originalField
      }
    `);
    const descriptor = describeDocument(document);
    expect(descriptor.debugName).toBe(
      `query {\n  aliasField: originalField\n}`,
    );
  });

  it("handles operations with variables", () => {
    const document = parse(`
      query MyQuery($id: ID!) {
        node(id: $id) {
          id
          name
        }
      }
    `);
    const descriptor = describeDocument(document);
    expect(descriptor.debugName).toBe("query MyQuery");
    expect(descriptor.definition.variableDefinitions?.length).toBe(1);
  });

  it("handles subscriptions", () => {
    const document = parse(`
      subscription MySubscription {
        field
      }
    `);
    const descriptor = describeDocument(document);
    expect(descriptor.debugName).toBe("subscription MySubscription");
    expect(descriptor.definition.operation).toBe("subscription");
  });

  it("handles mutations with variables and directives", () => {
    const document = parse(`
      mutation MyMutation($input: InputType!) @directive {
        field(input: $input) {
          result
        }
      }
    `);
    const descriptor = describeDocument(document);
    expect(descriptor.debugName).toBe("mutation MyMutation");
    expect(descriptor.definition.operation).toBe("mutation");
    expect(descriptor.definition.directives?.[0].name.value).toBe("directive");
  });

  it("handles operation with deeply nested selections", () => {
    const document = parse(`
      query {
        field1 {
          field2 {
            field3 {
              field4
            }
          }
        }
      }
    `);
    const descriptor = describeDocument(document);
    expect(descriptor.debugName).toBe(`query {\n  field1 {...}\n}`);
  });

  it("handles operation with multiple fragments", () => {
    const document = parse(`
      query {
        ...Fragment1
        ...Fragment2
      }
      fragment Fragment1 on Type1 {
        field1
      }
      fragment Fragment2 on Type2 {
        field2
      }
    `);
    const descriptor = describeDocument(document);
    expect(descriptor.debugName).toBe(
      `query {\n  ...Fragment1\n  ...Fragment2\n}`,
    );
    expect(descriptor.fragmentMap.size).toBe(2);
    expect(descriptor.fragmentMap.has("Fragment1")).toBe(true);
    expect(descriptor.fragmentMap.has("Fragment2")).toBe(true);
  });

  it("handles operation with inline fragments and type conditions", () => {
    const document = parse(`
      query {
        ... on Type1 {
          field1
        }
        ... on Type2 {
          field2
        }
      }
    `);
    const descriptor = describeDocument(document);
    expect(descriptor.debugName).toBe(
      `query {\n  ... on Type1 {...}\n  ... on Type2 {...}\n}`,
    );
    expect(descriptor.fragmentMap.size).toBe(0);
  });

  it("throws an error if operation definition is not an OperationDefinitionNode", () => {
    const document = parse(`
      schema {
        query: Query
      }
    `);
    expect(() => describeDocument(document)).toThrowError(
      "Must contain a query definition.",
    );
  });
});
