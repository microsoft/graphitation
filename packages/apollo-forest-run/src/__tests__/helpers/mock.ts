import { DocumentNode, FieldNode, valueFromASTUntyped, visit } from "graphql";
import { SourceObject } from "../../values/types";

/**
 * Generates mock objects from passed AST
 *
 * Examples:
 * { foo } => { foo: "foo" }
 * { foo { bar } } => { foo: { bar: "bar" } }
 * { foo @mock(value: "bar") } => { foo: "bar" }
 * { foo @mock(count: 2) { bar } } => { foo: [{ bar: "bar" }, { bar: "bar" }] }
 * { foo { bar @mock(missing: true) } } => { foo: { bar: undefined } }
 */
export function generateMockObject(doc: DocumentNode): SourceObject {
  const result = visit(doc, {
    Field: {
      leave: (node) => [
        node.alias?.value ?? node.name.value,
        itemsCount(node) === -1
          ? fieldValue(node)
          : [...new Array(itemsCount(node))].map(() => fieldValue(node)),
      ],
    },
    SelectionSet: {
      leave: (node) => Object.fromEntries(node.selections as any),
    },
    OperationDefinition: { leave: (node) => node.selectionSet },
    Document: { leave: (node) => node.definitions[0] },
  });
  return result as unknown as SourceObject;
}

export function removeMockDirectives(doc: DocumentNode) {
  visit(doc, {
    Directive: (node) => (node.name.value === "mock" ? null : node),
  });
}

function itemsCount(field: FieldNode): number {
  return Number(arg(field, "count") ?? -1);
}

function fieldValue(field: FieldNode): any {
  if (arg(field, "missing")) {
    return undefined; // skip
  }
  const value = arg(field, "value");
  const result =
    value === null ? null : value ?? field.selectionSet ?? field.name.value;

  if (typeof result !== "object" || result === null) {
    return result;
  }
  return Array.isArray(result) ? [...result] : { ...result };
}

function arg(field: FieldNode, name: string): unknown {
  const directive = field.directives?.find(
    (directive) => directive.name.value === "mock",
  );
  const valueNode = directive?.arguments?.find(
    (arg) => arg.name.value === name,
  )?.value;
  return valueNode ? valueFromASTUntyped(valueNode) : undefined;
}
