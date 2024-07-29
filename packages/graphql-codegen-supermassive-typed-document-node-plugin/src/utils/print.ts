/**
 * Source: https://github.com/graphql/graphql-js/blob/16.x.x/src/language/printer.ts
 */

import type { ASTNode, ASTKindToNode, Visitor } from "graphql";
import { visit } from "graphql";
import type { ASTReducer } from "./types";
import { printBlockString } from "./block-string";
import { printString } from "./print-string";

type Maybe<T> = T | undefined | null;

/**
 * Converts an AST into a compact string
 */
export function print(ast: ASTNode): string {
  return visit(ast, printDocASTReducer as Visitor<ASTKindToNode>);
}

const printDocASTReducer: ASTReducer<string> = {
  Name: { leave: (node) => node.value },
  Variable: { leave: (node) => "$" + node.name },

  Document: {
    leave: (node) => join(node.definitions, " "),
  },

  OperationDefinition: {
    leave(node) {
      const varDefs = wrap("(", join(node.variableDefinitions, ","), ")");
      const prefix = join(
        [
          node.operation,
          join([node.name, varDefs]),
          join(node.directives, " "),
        ],
        " ",
      );

      // Anonymous queries with no directives or variable definitions can use
      // the query short form.
      return (prefix === "query" ? "" : prefix + " ") + node.selectionSet;
    },
  },

  VariableDefinition: {
    leave: ({ variable, type, defaultValue, directives }) =>
      variable +
      ":" +
      type +
      wrap("=", defaultValue) +
      wrap(" ", join(directives, " ")),
  },
  SelectionSet: { leave: ({ selections }) => block(selections) },

  Field: {
    leave({ alias, name, arguments: args, directives, selectionSet }) {
      const prefix = wrap("", alias, ":") + name;
      const argsLine = prefix + wrap("(", join(args, ","), ")");

      return join([argsLine, join(directives, " "), selectionSet], " ");
    },
  },

  Argument: { leave: ({ name, value }) => name + ":" + value },

  FragmentSpread: {
    leave: ({ name, directives }) =>
      "..." + name + wrap(" ", join(directives, " ")),
  },

  InlineFragment: {
    leave: ({ typeCondition, directives, selectionSet }) =>
      join(
        [
          "...",
          wrap("on ", typeCondition),
          join(directives, " "),
          selectionSet,
        ],
        " ",
      ),
  },

  FragmentDefinition: {
    leave: ({
      name,
      typeCondition,
      variableDefinitions,
      directives,
      selectionSet,
    }) =>
      // Note: fragment variable definitions are experimental and may be changed
      // or removed in the future.
      `fragment ${name}${wrap("(", join(variableDefinitions, ","), ")")} ` +
      `on ${typeCondition} ${wrap("", join(directives, " "), " ")}` +
      selectionSet,
  },

  IntValue: { leave: ({ value }) => value },
  FloatValue: { leave: ({ value }) => value },
  StringValue: {
    leave: ({ value, block: isBlockString }) =>
      isBlockString ? printBlockString(value) : printString(value),
  },
  BooleanValue: { leave: ({ value }) => (value ? "true" : "false") },
  NullValue: { leave: () => "null" },
  EnumValue: { leave: ({ value }) => value },
  ListValue: { leave: ({ values }) => "[" + join(values, ",") + "]" },
  ObjectValue: { leave: ({ fields }) => "{" + join(fields, ",") + "}" },
  ObjectField: { leave: ({ name, value }) => name + ":" + value },

  Directive: {
    leave: ({ name, arguments: args }) =>
      "@" + name + wrap("(", join(args, ","), ")"),
  },

  NamedType: { leave: ({ name }) => name },
  ListType: { leave: ({ type }) => "[" + type + "]" },
  NonNullType: { leave: ({ type }) => type + "!" },

  SchemaDefinition: {
    leave: ({ description, directives, operationTypes }) =>
      wrap("", description, " ") +
      join(["schema", join(directives, " "), block(operationTypes)], " "),
  },

  OperationTypeDefinition: {
    leave: ({ operation, type }) => operation + ":" + type,
  },

  ScalarTypeDefinition: {
    leave: ({ description, name, directives }) =>
      wrap("", description, " ") +
      join(["scalar", name, join(directives, " ")], " "),
  },

  ObjectTypeDefinition: {
    leave: ({ description, name, interfaces, directives, fields }) =>
      wrap("", description, " ") +
      join(
        [
          "type",
          name,
          wrap("implements ", join(interfaces, " & ")),
          join(directives, " "),
          block(fields),
        ],
        " ",
      ),
  },

  FieldDefinition: {
    leave: ({ description, name, arguments: args, type, directives }) =>
      wrap("", description, " ") +
      name +
      wrap("(", join(args, ","), ")") +
      ": " +
      type +
      wrap(" ", join(directives, " ")),
  },

  InputValueDefinition: {
    leave: ({ description, name, type, defaultValue, directives }) =>
      wrap("", description, " ") +
      join(
        [name + ":" + type, wrap("=", defaultValue), join(directives, " ")],
        " ",
      ),
  },

  InterfaceTypeDefinition: {
    leave: ({ description, name, interfaces, directives, fields }) =>
      wrap("", description, " ") +
      join(
        [
          "interface",
          name,
          wrap("implements ", join(interfaces, " & ")),
          join(directives, " "),
          block(fields),
        ],
        " ",
      ),
  },

  UnionTypeDefinition: {
    leave: ({ description, name, directives, types }) =>
      wrap("", description, " ") +
      join(
        ["union", name, join(directives, " "), wrap("=", join(types, " | "))],
        " ",
      ),
  },

  EnumTypeDefinition: {
    leave: ({ description, name, directives, values }) =>
      wrap("", description, " ") +
      join(["enum", name, join(directives, " "), block(values)], " "),
  },

  EnumValueDefinition: {
    leave: ({ description, name, directives }) =>
      wrap("", description, " ") + join([name, join(directives, " ")], " "),
  },

  InputObjectTypeDefinition: {
    leave: ({ description, name, directives, fields }) =>
      wrap("", description, " ") +
      join(["input", name, join(directives, " "), block(fields)], " "),
  },

  DirectiveDefinition: {
    leave: ({ description, name, arguments: args, repeatable, locations }) =>
      wrap("", description, " ") +
      "directive @" +
      name +
      wrap("(", join(args, ","), ")") +
      (repeatable ? " repeatable" : "") +
      " on " +
      join(locations, " | "),
  },

  SchemaExtension: {
    leave: ({ directives, operationTypes }) =>
      join(
        ["extend schema", join(directives, " "), block(operationTypes)],
        " ",
      ),
  },

  ScalarTypeExtension: {
    leave: ({ name, directives }) =>
      join(["extend scalar", name, join(directives, " ")], " "),
  },

  ObjectTypeExtension: {
    leave: ({ name, interfaces, directives, fields }) =>
      join(
        [
          "extend type",
          name,
          wrap("implements ", join(interfaces, " & ")),
          join(directives, " "),
          block(fields),
        ],
        " ",
      ),
  },

  InterfaceTypeExtension: {
    leave: ({ name, interfaces, directives, fields }) =>
      join(
        [
          "extend interface",
          name,
          wrap("implements ", join(interfaces, " & ")),
          join(directives, " "),
          block(fields),
        ],
        " ",
      ),
  },

  UnionTypeExtension: {
    leave: ({ name, directives, types }) =>
      join(
        [
          "extend union",
          name,
          join(directives, " "),
          wrap("=", join(types, " | ")),
        ],
        " ",
      ),
  },

  EnumTypeExtension: {
    leave: ({ name, directives, values }) =>
      join(["extend enum", name, join(directives, " "), block(values)], " "),
  },

  InputObjectTypeExtension: {
    leave: ({ name, directives, fields }) =>
      join(["extend input", name, join(directives, " "), block(fields)], " "),
  },
};

/**
 * Given maybeArray, print an empty string if it is null or empty, otherwise
 * print all items together separated by separator if provided
 */
function join(
  maybeArray: Maybe<ReadonlyArray<string | undefined>>,
  separator = "",
): string {
  return maybeArray?.filter((x) => x).join(separator) ?? "";
}

/**
 * Given array, print each item on its own line, wrapped in an indented `{ }` block.
 */
function block(array: Maybe<ReadonlyArray<string | undefined>>): string {
  return wrap("{", join(array, ","), "}");
}

/**
 * If maybeString is not null or empty, then wrap with start and end, otherwise print an empty string.
 */
function wrap(start: string, maybeString: Maybe<string>, end = ""): string {
  return maybeString != null && maybeString !== ""
    ? start + maybeString + end
    : "";
}
