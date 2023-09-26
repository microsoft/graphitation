import { GraphQLScalarType, parseValue } from "graphql";

import {
  InputObjectTypeDefinitionTuple,
  SchemaDefinitions,
  createEnumTypeDefinition,
  createInputObjectTypeDefinition,
  createScalarTypeDefinition,
  typeReferenceFromName as ref,
} from "@graphitation/supermassive-ast";
import {
  identityFunc,
  invariant,
  type ObjMap,
} from "@graphitation/supermassive-common";
import { SchemaFragment, UserResolvers } from "../../types";
import { valueFromAST } from "../valueFromAST";

describe("valueFromAST", () => {
  function createTestSchemaFragment(
    definitions: SchemaDefinitions = { types: {} },
    resolvers: UserResolvers = {},
  ) {
    return { schemaId: "test", definitions, resolvers };
  }

  function expectValueFrom(
    valueText: string | null,
    type: string,
    schemaFragment: SchemaFragment = createTestSchemaFragment(),
    variables?: ObjMap<unknown>,
  ) {
    const typeRef = ref(type);
    const ast = valueText !== null ? parseValue(valueText) : null;
    const value = valueFromAST(ast, typeRef, schemaFragment, variables);
    return expect(value);
  }

  function createSchemaWithTestInput() {
    const TestInput: InputObjectTypeDefinitionTuple =
      createInputObjectTypeDefinition({
        int: [ref("Int"), 42],
        bool: ref("Boolean"),
        requiredBool: ref("Boolean!"),
      });
    return createTestSchemaFragment({ types: { TestInput } });
  }

  it("rejects empty input", () => {
    expectValueFrom(null, "Boolean").toBe(undefined);
  });

  it("converts according to input coercion rules", () => {
    expectValueFrom("true", "Boolean").toEqual(true);
    expectValueFrom("false", "Boolean").toEqual(false);
    expectValueFrom("123", "Int").toEqual(123);
    expectValueFrom("123", "Float").toEqual(123);
    expectValueFrom("123.456", "Float").toEqual(123.456);
    expectValueFrom('"abc123"', "String").toEqual("abc123");
    expectValueFrom("123456", "ID").toEqual("123456");
    expectValueFrom('"123456"', "ID").toEqual("123456");
  });

  it("does not convert when input coercion rules reject a value", () => {
    expectValueFrom("123", "Boolean").toEqual(undefined);
    expectValueFrom("123.456", "Int").toEqual(undefined);
    expectValueFrom("true", "Int").toEqual(undefined);
    expectValueFrom('"123"', "Int").toEqual(undefined);
    expectValueFrom('"123"', "Float").toEqual(undefined);
    expectValueFrom("123", "String").toEqual(undefined);
    expectValueFrom("true", "String").toEqual(undefined);
    expectValueFrom("123.456", "String").toEqual(undefined);
  });

  it("convert using parseLiteral from a custom scalar type", () => {
    const resolvers = {
      Passthrough: new GraphQLScalarType({
        name: "Passthrough",
        parseLiteral(node) {
          invariant(node.kind === "StringValue");
          return node.value;
        },
        parseValue: identityFunc,
      }),
      ThrowScalar: new GraphQLScalarType({
        name: "ThrowScalar",
        parseLiteral() {
          throw new Error("Test");
        },
        parseValue: identityFunc,
      }),
      ReturnUndefined: new GraphQLScalarType({
        name: "ReturnUndefined",
        parseLiteral() {
          return undefined;
        },
        parseValue: identityFunc,
      }),
    };
    const definitions: SchemaDefinitions = {
      types: {
        Passthrough: createScalarTypeDefinition(),
        ThrowScalar: createScalarTypeDefinition(),
        ReturnUndefined: createScalarTypeDefinition(),
      },
    };
    const fragment = createTestSchemaFragment(definitions, resolvers);

    expectValueFrom('"value"', "Passthrough", fragment).toEqual("value");
    expectValueFrom("value", "ThrowScalar", fragment).toEqual(undefined);
    expectValueFrom("value", "ReturnUndefined", fragment).toEqual(undefined);
  });

  it("converts enum values according to input coercion rules", () => {
    const resolvers = {
      TestColor: {
        RED: 1,
        GREEN: 2,
        BLUE: 3,
        NULL: null,
        NAN: NaN,
        NO_CUSTOM_VALUE: undefined,
      },
    };
    const definitions: SchemaDefinitions = {
      types: {
        TestColor: createEnumTypeDefinition([
          "RED",
          "GREEN",
          "BLUE",
          "NULL",
          "NAN",
          "NO_CUSTOM_VALUE",
        ]),
      },
    };
    const fragment = createTestSchemaFragment(definitions, resolvers);

    expectValueFrom("RED", "TestColor", fragment).toEqual(1);
    expectValueFrom("BLUE", "TestColor", fragment).toEqual(3);
    expectValueFrom("3", "TestColor", fragment).toEqual(undefined);
    expectValueFrom('"BLUE"', "TestColor", fragment).toEqual(undefined);
    expectValueFrom("null", "TestColor", fragment).toEqual(null);
    expectValueFrom("NULL", "TestColor", fragment).toEqual(null);
    expectValueFrom("NULL", "TestColor!", fragment).toEqual(null);
    expectValueFrom("NAN", "TestColor", fragment).toEqual(NaN);
    expectValueFrom("NO_CUSTOM_VALUE", "TestColor", fragment).toEqual(
      "NO_CUSTOM_VALUE",
    );
  });

  it("coerces to null unless non-null", () => {
    expectValueFrom("null", "Boolean").toEqual(null);
    expectValueFrom("null", "Boolean!").toEqual(undefined);
  });

  it("coerces lists of values", () => {
    expectValueFrom("true", "[Boolean]").toEqual([true]);
    expectValueFrom("123", "[Boolean]").toEqual(undefined);
    expectValueFrom("null", "[Boolean]").toEqual(null);
    expectValueFrom("[true, false]", "[Boolean]").toEqual([true, false]);
    expectValueFrom("[true, 123]", "[Boolean]").toEqual(undefined);
    expectValueFrom("[true, null]", "[Boolean]").toEqual([true, null]);
    expectValueFrom("{ true: true }", "[Boolean]").toEqual(undefined);
  });

  it("coerces non-null lists of values", () => {
    expectValueFrom("true", "[Boolean]!").toEqual([true]);
    expectValueFrom("123", "[Boolean]!").toEqual(undefined);
    expectValueFrom("null", "[Boolean]!").toEqual(undefined);
    expectValueFrom("[true, false]", "[Boolean]!").toEqual([true, false]);
    expectValueFrom("[true, 123]", "[Boolean]!").toEqual(undefined);
    expectValueFrom("[true, null]", "[Boolean]!").toEqual([true, null]);
  });

  it("coerces lists of non-null values", () => {
    expectValueFrom("true", "[Boolean!]").toEqual([true]);
    expectValueFrom("123", "[Boolean!]").toEqual(undefined);
    expectValueFrom("null", "[Boolean!]").toEqual(null);
    expectValueFrom("[true, false]", "[Boolean!]").toEqual([true, false]);
    expectValueFrom("[true, 123]", "[Boolean!]").toEqual(undefined);
    expectValueFrom("[true, null]", "[Boolean!]").toEqual(undefined);
  });

  it("coerces non-null lists of non-null values", () => {
    expectValueFrom("true", "[Boolean!]!").toEqual([true]);
    expectValueFrom("123", "[Boolean!]!").toEqual(undefined);
    expectValueFrom("null", "[Boolean!]!").toEqual(undefined);
    expectValueFrom("[true, false]", "[Boolean!]!").toEqual([true, false]);
    expectValueFrom("[true, 123]", "[Boolean!]!").toEqual(undefined);
    expectValueFrom("[true, null]", "[Boolean!]!").toEqual(undefined);
  });

  it("coerces input objects according to input coercion rules", () => {
    const schema = createSchemaWithTestInput();
    expectValueFrom("null", "TestInput", schema).toEqual(null);
    expectValueFrom("123", "TestInput", schema).toEqual(undefined);
    expectValueFrom("[]", "TestInput", schema).toEqual(undefined);
    expectValueFrom(
      "{ int: 123, requiredBool: false }",
      "TestInput",
      schema,
    ).toEqual({ int: 123, requiredBool: false });
    expectValueFrom(
      "{ bool: true, requiredBool: false }",
      "TestInput",
      schema,
    ).toEqual({
      int: 42,
      bool: true,
      requiredBool: false,
    });
    expectValueFrom(
      "{ int: true, requiredBool: true }",
      "TestInput",
      schema,
    ).toEqual(undefined);
    expectValueFrom("{ requiredBool: null }", "TestInput", schema).toEqual(
      undefined,
    );
    expectValueFrom("{ bool: true }", "TestInput", schema).toEqual(undefined);
  });

  it("accepts variable values assuming already coerced", () => {
    const _ = undefined;
    expectValueFrom("$var", "Boolean", _, {}).toEqual(undefined);
    expectValueFrom("$var", "Boolean", _, { var: true }).toEqual(true);
    expectValueFrom("$var", "Boolean", _, { var: null }).toEqual(null);
    expectValueFrom("$var", "Boolean!", _, { var: null }).toEqual(undefined);
  });

  it("asserts variables are provided as items in lists", () => {
    const _ = undefined;
    expectValueFrom("[ $foo ]", "[Boolean]", _, {}).toEqual([null]);
    expectValueFrom("[ $foo ]", "[Boolean!]", _, {}).toEqual(undefined);
    expectValueFrom("[ $foo ]", "[Boolean!]", _, {
      foo: true,
    }).toEqual([true]);
    // Note: variables are expected to have already been coerced, so we
    // do not expect the singleton wrapping behavior for variables.
    expectValueFrom("$foo", "[Boolean!]", _, { foo: true }).toEqual(true);
    expectValueFrom("$foo", "[Boolean!]", _, { foo: [true] }).toEqual([true]);
  });

  it("omits input object fields for unprovided variables", () => {
    const schema = createSchemaWithTestInput();

    expectValueFrom(
      "{ int: $foo, bool: $foo, requiredBool: true }",
      "TestInput",
      schema,
      {},
    ).toEqual({ int: 42, requiredBool: true });

    expectValueFrom("{ requiredBool: $foo }", "TestInput", schema, {}).toEqual(
      undefined,
    );

    expectValueFrom("{ requiredBool: $foo }", "TestInput", schema, {
      foo: true,
    }).toEqual({
      int: 42,
      requiredBool: true,
    });
  });
});
