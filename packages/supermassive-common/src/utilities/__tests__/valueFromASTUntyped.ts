import { parseValue } from "graphql";
import { valueFromASTUntyped } from "../valueFromASTUntyped";
import type { ObjMap } from "../../jsutils/ObjMap";

describe("valueFromASTUntyped", () => {
  function expectValueFrom(valueText: string, variables?: ObjMap<unknown>) {
    const ast = parseValue(valueText);
    const value = valueFromASTUntyped(ast, variables);
    return expect(value);
  }

  it("converts according to input coercion rules", () => {
    expectValueFrom("true").toEqual(true);
    expectValueFrom("false").toEqual(false);
    expectValueFrom("123").toEqual(123);
    expectValueFrom("123").toEqual(123);
    expectValueFrom("123.456").toEqual(123.456);
    expectValueFrom('"abc123"').toEqual("abc123");
    expectValueFrom("123456").toEqual(123456);
    expectValueFrom('"123456"').toEqual("123456");
  });

  it("coerces to null", () => {
    expectValueFrom("null").toEqual(null);
  });

  it("coerces lists of values", () => {
    expectValueFrom("[true, false]").toEqual([true, false]);
    expectValueFrom("[true, 123]").toEqual([true, 123]);
    expectValueFrom("[true, null]").toEqual([true, null]);
  });

  it("coerces input objects according to input coercion rules", () => {
    expectValueFrom("{ int: 123, requiredBool: false }").toEqual({
      int: 123,
      requiredBool: false,
    });
    expectValueFrom("{ bool: true, requiredBool: false }").toEqual({
      bool: true,
      requiredBool: false,
    });
    expectValueFrom("{ int: true, requiredBool: true }").toEqual({
      int: true,
      requiredBool: true,
    });
  });

  it("accepts variable values assuming already coerced", () => {
    const _ = undefined;
    expectValueFrom("$var", {}).toEqual(undefined);
    expectValueFrom("$var", { var: true }).toEqual(true);
    expectValueFrom("$var", { var: null }).toEqual(null);
  });

  it("asserts variables are provided as items in lists", () => {
    const _ = undefined;
    expectValueFrom("[ $foo ]", {}).toEqual([undefined]);
    expectValueFrom("[ $foo ]", {
      foo: true,
    }).toEqual([true]);
    // Note: variables are expected to have already been coerced, so we
    // do not expect the singleton wrapping behavior for variables.
    expectValueFrom("$foo", { foo: true }).toEqual(true);
    expectValueFrom("$foo", { foo: [true] }).toEqual([true]);
  });

  it("omits input object fields for unprovided variables", () => {
    expectValueFrom(
      "{ int: $foo, bool: $foo, requiredBool: true }",
      {},
    ).toEqual({ requiredBool: true });

    expectValueFrom("{ requiredBool: $foo }", {}).toEqual({
      requiredBool: undefined,
    });

    expectValueFrom("{ requiredBool: $foo }", {
      foo: true,
    }).toEqual({
      requiredBool: true,
    });
  });
});
