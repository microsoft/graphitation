import { parse, OperationDefinitionNode } from "graphql";
import { describeDocument } from "../document";
import { describeResultTree } from "../possibleSelection";
import { describeOperation, applyDefaultValues } from "../operation";
import type { VariableDefinitionNode } from "graphql";
import type { OperationEnv } from "../types";

describe(describeOperation, () => {
  it("applies default rootTypeName and rootNodeKey for queries", () => {
    const document = parse(`
      query MyQuery {
        field
      }
    `);
    const docDescriptor = describeDocument(document);
    const resultTree = describeResultTree(docDescriptor);
    const variables = {};
    const env: OperationEnv = {};

    const operation = describeOperation(
      env,
      docDescriptor,
      resultTree,
      variables,
    );

    expect(operation.rootType).toBe("Query");
    expect(operation.rootNodeKey).toBe("ROOT_QUERY");
  });

  it("applies default rootTypeName and rootNodeKey for mutations", () => {
    const document = parse(`
      mutation MyMutation {
        field
      }
    `);
    const docDescriptor = describeDocument(document);
    const resultTree = describeResultTree(docDescriptor);
    const variables = {};
    const env: OperationEnv = {};

    const operation = describeOperation(
      env,
      docDescriptor,
      resultTree,
      variables,
    );

    expect(operation.rootType).toBe("Mutation");
    expect(operation.rootNodeKey).toBe("ROOT_MUTATION");
  });

  it("uses provided rootTypeName and rootNodeKey when specified", () => {
    const document = parse(`
      query MyQuery {
        field
      }
    `);
    const docDescriptor = describeDocument(document);
    const resultTree = describeResultTree(docDescriptor);
    const variables = {};
    const env: OperationEnv = {};

    const operation = describeOperation(
      env,
      docDescriptor,
      resultTree,
      variables,
      undefined,
      "CustomRootType",
      "CUSTOM_ROOT",
    );

    expect(operation.rootType).toBe("CustomRootType");
    expect(operation.rootNodeKey).toBe("CUSTOM_ROOT");
  });

  it("applies default values to variables when variablesWithDefaults is not provided", () => {
    const document = parse(`
      query MyQuery($var1: String = "default", $var2: Int) {
        field
      }
    `);
    const docDescriptor = describeDocument(document);
    const resultTree = describeResultTree(docDescriptor);
    const variables = { var2: 42 };
    const env: OperationEnv = {};

    const operation = describeOperation(
      env,
      docDescriptor,
      resultTree,
      variables,
    );

    expect(operation.variablesWithDefaults).toEqual({
      var1: "default",
      var2: 42,
    });
  });

  it("uses provided variablesWithDefaults when specified", () => {
    const document = parse(`
      query MyQuery($var1: String = "default", $var2: Int) {
        field
      }
    `);
    const docDescriptor = describeDocument(document);
    const resultTree = describeResultTree(docDescriptor);
    const variables = { var2: 42 };
    const variablesWithDefaults = { var1: "provided", var2: 42 };
    const env: OperationEnv = {};

    const operation = describeOperation(
      env,
      docDescriptor,
      resultTree,
      variables,
      variablesWithDefaults,
    );

    expect(operation.variablesWithDefaults).toEqual({
      var1: "provided",
      var2: 42,
    });
  });

  it("extracts keyVariables from @cache directive", () => {
    const document = parse(`
      query MyQuery @cache(keyVars: ["var1", "var2"]) {
        field
      }
    `);
    const docDescriptor = describeDocument(document);
    const resultTree = describeResultTree(docDescriptor);
    const variables = {};
    const env: OperationEnv = {};

    const operation = describeOperation(
      env,
      docDescriptor,
      resultTree,
      variables,
    );

    expect(operation.keyVariables).toEqual(["var1", "var2"]);
  });

  it("sets keyVariables to null when there is no @cache directive", () => {
    const document = parse(`
      query MyQuery {
        field
      }
    `);
    const docDescriptor = describeDocument(document);
    const resultTree = describeResultTree(docDescriptor);
    const variables = {};
    const env: OperationEnv = {};

    const operation = describeOperation(
      env,
      docDescriptor,
      resultTree,
      variables,
    );

    expect(operation.keyVariables).toBeNull();
  });

  it("throws an error when keyVars directive has invalid format", () => {
    const document = parse(`
      query MyQuery @cache(keyVars: "var1") {
        field
      }
    `);
    const docDescriptor = describeDocument(document);
    const resultTree = describeResultTree(docDescriptor);
    const variables = {};
    const env: OperationEnv = {};

    expect(() =>
      describeOperation(env, docDescriptor, resultTree, variables),
    ).toThrowError(
      'Could not extract keyVars. Expected directive format: @cache(keyVars=["var1", "var2"]), got "var1" in place of keyVars',
    );
  });

  it("throws an error when keyVars contains non-string values", () => {
    const document = parse(`
      query MyQuery @cache(keyVars: ["var1", 42]) {
        field
      }
    `);
    const docDescriptor = describeDocument(document);
    const resultTree = describeResultTree(docDescriptor);
    const variables = {};
    const env: OperationEnv = {};

    expect(() =>
      describeOperation(env, docDescriptor, resultTree, variables),
    ).toThrowError(
      'Could not extract keyVars. Expected directive format: @cache(keyVars=["var1", "var2"]), got ["var1",42] in place of keyVars',
    );
  });

  it("sets cache property to true for queries without @cache directive", () => {
    const document = parse(`
      query MyQuery {
        field
      }
    `);
    const docDescriptor = describeDocument(document);
    const resultTree = describeResultTree(docDescriptor);
    const variables = {};
    const env: OperationEnv = {};

    const operation = describeOperation(
      env,
      docDescriptor,
      resultTree,
      variables,
    );

    expect(operation.cache).toBe(true);
  });

  it("sets cache property to false for mutations without @cache directive", () => {
    const document = parse(`
      mutation MyMutation {
        field
      }
    `);
    const docDescriptor = describeDocument(document);
    const resultTree = describeResultTree(docDescriptor);
    const variables = {};
    const env: OperationEnv = {};

    const operation = describeOperation(
      env,
      docDescriptor,
      resultTree,
      variables,
    );

    expect(operation.cache).toBe(false);
  });

  it("sets cache property to true for mutations with @cache directive", () => {
    const document = parse(`
      mutation MyMutation @cache {
        field
      }
    `);
    const docDescriptor = describeDocument(document);
    const resultTree = describeResultTree(docDescriptor);
    const variables = {};
    const env: OperationEnv = {};

    const operation = describeOperation(
      env,
      docDescriptor,
      resultTree,
      variables,
    );

    expect(operation.cache).toBe(true);
  });

  it("throws an error for unexpected operation type", () => {
    const document = parse(`
      query MyQuery {
        field
      }
    `);
    const docDescriptor = describeDocument(document);
    // Simulate an unexpected operation type
    const fakeDefinition = {
      ...docDescriptor.definition,
      operation: "unexpected" as any,
    } as OperationDefinitionNode;
    const fakeDocDescriptor = {
      ...docDescriptor,
      definition: fakeDefinition,
    };
    const resultTree = describeResultTree(fakeDocDescriptor);
    const variables = {};
    const env: OperationEnv = {};

    expect(() =>
      describeOperation(env, fakeDocDescriptor, resultTree, variables),
    ).toThrowError("Unexpected operation type: unexpected");
  });

  it("applies default values when variableValues are empty", () => {
    const document = parse(`
      query MyQuery($var1: String = "default") {
        field
      }
    `);
    const docDescriptor = describeDocument(document);
    const resultTree = describeResultTree(docDescriptor);
    const variables = {};
    const env: OperationEnv = {};

    const operation = describeOperation(
      env,
      docDescriptor,
      resultTree,
      variables,
    );

    expect(operation.variablesWithDefaults).toEqual({ var1: "default" });
  });

  it("does not override provided variable values with default values", () => {
    const document = parse(`
      query MyQuery($var1: String = "default") {
        field
      }
    `);
    const docDescriptor = describeDocument(document);
    const resultTree = describeResultTree(docDescriptor);
    const variables = { var1: "provided" };
    const env: OperationEnv = {};

    const operation = describeOperation(
      env,
      docDescriptor,
      resultTree,
      variables,
    );

    expect(operation.variablesWithDefaults).toEqual({ var1: "provided" });
  });

  it("handles subscriptions correctly", () => {
    const document = parse(`
      subscription MySubscription {
        field
      }
    `);
    const docDescriptor = describeDocument(document);
    const resultTree = describeResultTree(docDescriptor);
    const variables = {};
    const env: OperationEnv = {};

    const operation = describeOperation(
      env,
      docDescriptor,
      resultTree,
      variables,
    );

    expect(operation.rootType).toBe("Subscription");
    expect(operation.rootNodeKey).toBe("ROOT_SUBSCRIPTION");
    expect(operation.cache).toBe(true); // Assuming subscriptions are cached
  });

  it("handles operations with directives correctly", () => {
    const document = parse(`
      query MyQuery @client {
        field
      }
    `);
    const docDescriptor = describeDocument(document);
    const resultTree = describeResultTree(docDescriptor);
    const variables = {};
    const env: OperationEnv = {};

    const operation = describeOperation(
      env,
      docDescriptor,
      resultTree,
      variables,
    );

    expect(operation.cache).toBe(true);
    expect(operation.definition.directives?.[0].name.value).toBe("client");
  });

  it("applies default values for variables with null default values", () => {
    const document = parse(`
      query MyQuery($var1: String = null) {
        field
      }
    `);
    const docDescriptor = describeDocument(document);
    const resultTree = describeResultTree(docDescriptor);
    const variables = {};
    const env: OperationEnv = {};

    const operation = describeOperation(
      env,
      docDescriptor,
      resultTree,
      variables,
    );

    expect(operation.variablesWithDefaults).toEqual({ var1: null });
  });

  it("handles variables with default values of different types", () => {
    const document = parse(`
      query MyQuery($var1: Boolean = true, $var2: Int = 0, $var3: Float = 3.14) {
        field
      }
    `);
    const docDescriptor = describeDocument(document);
    const resultTree = describeResultTree(docDescriptor);
    const variables = { var2: 42 };
    const env: OperationEnv = {};

    const operation = describeOperation(
      env,
      docDescriptor,
      resultTree,
      variables,
    );

    expect(operation.variablesWithDefaults).toEqual({
      var1: true,
      var2: 42,
      var3: 3.14,
    });
  });

  it("handles variables with default values of list and object types", () => {
    const document = parse(`
      query MyQuery($var1: [Int] = [1, 2, 3], $var2: InputType = { field: "value" }) {
        field
      }
    `);
    const docDescriptor = describeDocument(document);
    const resultTree = describeResultTree(docDescriptor);
    const variables = { var1: [4, 5, 6] };
    const env: OperationEnv = {};

    const operation = describeOperation(
      env,
      docDescriptor,
      resultTree,
      variables,
    );

    expect(operation.variablesWithDefaults).toEqual({
      var1: [4, 5, 6],
      var2: { field: "value" },
    });
  });
});

describe(applyDefaultValues, () => {
  /**
   * Parses variable definitions from a string.
   */
  const parseVars = (vars: string): VariableDefinitionNode[] => {
    const document = parse(`query (${vars}) { __typename }`);
    const operationDefinition = document
      .definitions[0] as OperationDefinitionNode;
    return (operationDefinition.variableDefinitions ||
      []) as VariableDefinitionNode[];
  };

  it("applies default values from variable definitions", () => {
    const variableDefinitions = parseVars(
      `$var1: String = "default", $var2: Int = 42`,
    );
    const variables = { var2: 100 };
    const result = applyDefaultValues(variables, variableDefinitions);
    expect(result).toEqual({ var1: "default", var2: 100 });
  });

  it("does not override provided variable values", () => {
    const variableDefinitions = parseVars(`$var1: String = "default"`);
    const variables = { var1: "provided" };
    const result = applyDefaultValues(variables, variableDefinitions);
    expect(result).toEqual({ var1: "provided" });
  });

  it("returns variables as-is when there are no variable definitions", () => {
    const variables = { var1: "value" };
    const result = applyDefaultValues(variables, undefined);
    expect(result).toEqual(variables);
  });

  it("handles undefined variables gracefully", () => {
    const variableDefinitions = parseVars(`$var1: String = "default"`);
    const variables = {};
    const result = applyDefaultValues(variables, variableDefinitions);
    expect(result).toEqual({ var1: "default" });
  });

  it("treats variables without default values as null", () => {
    // See: http://spec.graphql.org/draft/#sec-Coercing-Variable-Values
    const variableDefinitions = parseVars(`$var1: String`);
    const variables = {};
    const result = applyDefaultValues(variables, variableDefinitions);
    expect(result).toEqual({
      // FIXME: uncomment the following line for spec-compatible behavior
      //   (disabled to enable Apollo compatibility which is not spec compliant)
      // var1: null,
    });
  });

  it("applies default values for variables with null default values", () => {
    const variableDefinitions = parseVars(`$var1: String = null`);
    const variables = {};
    const result = applyDefaultValues(variables, variableDefinitions);
    expect(result).toEqual({ var1: null });
  });

  it("handles variables with default values of different types", () => {
    const variableDefinitions = parseVars(
      `$var1: Boolean = true, $var2: Int = 0, $var3: Float = 3.14`,
    );
    const variables = { var2: 42 };
    const result = applyDefaultValues(variables, variableDefinitions);
    expect(result).toEqual({
      var1: true,
      var2: 42,
      var3: 3.14,
    });
  });

  it("handles variables with default values of list and object types", () => {
    const variableDefinitions = parseVars(
      `$var1: [Int] = [1, 2, 3], $var2: InputType = { field: "value" }`,
    );
    const variables = { var1: [4, 5, 6] };
    const result = applyDefaultValues(variables, variableDefinitions);
    expect(result).toEqual({
      var1: [4, 5, 6],
      var2: { field: "value" },
    });
  });

  it("handles variables with complex default values", () => {
    const document = parse(`
      query MyQuery($var1: [String] = ["a", "b"], $var2: InputType = { field: "value" }) {
        field
      }
    `);
    const docDescriptor = describeDocument(document);
    const resultTree = describeResultTree(docDescriptor);
    const variables = {};
    const env: OperationEnv = {};

    const operation = describeOperation(
      env,
      docDescriptor,
      resultTree,
      variables,
    );

    expect(operation.variablesWithDefaults).toEqual({
      var1: ["a", "b"],
      var2: { field: "value" },
    });
  });
});
