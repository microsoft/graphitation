import invariant from "invariant";
import { Argument, ArgumentValue, LinkedField } from "relay-compiler";
import { IRTransform } from "relay-compiler/lib/core/CompilerContext";
import { visit } from "relay-compiler/lib/core/IRVisitor";

// TODO: Add typings for this
const SchemaUtils = require("relay-compiler/lib/core/SchemaUtils");

export function emitApolloClientConnectionTransform(
  wrappedConnectionTransform: IRTransform
): IRTransform {
  const connectionTransformWrapper: IRTransform = (context) => {
    const schema = context.getSchema();
    let nextContext = wrappedConnectionTransform(context);

    // Replaces the field handle created by the wrapped connection transform
    // with the @connection directive that Apollo Client expects
    nextContext.forEachDocument((document) => {
      const nextDocument = visit(document, {
        LinkedField(linkedFieldNode) {
          const connectionHandle = linkedFieldNode.handles?.find(
            (handle) => handle.name === "connection"
          );
          if (connectionHandle) {
            const args: Argument[] = [
              {
                kind: "Argument",
                name: "key",
                type: SchemaUtils.getNonNullStringInput(schema),
                value: {
                  kind: "Literal",
                  value: connectionHandle.key,
                  loc: { kind: "Generated" },
                },
                loc: { kind: "Generated" },
                metadata: undefined,
              },
            ];
            if (connectionHandle.filters) {
              args.push({
                kind: "Argument",
                name: "filter",
                type: schema.assertInputType(
                  schema.expectTypeFromString("[String!]")
                ),
                value: {
                  kind: "ListValue",
                  items: connectionHandle.filters.map<ArgumentValue>(
                    (filter) => ({
                      kind: "Literal",
                      value: filter,
                      loc: { kind: "Generated" },
                    })
                  ),
                  loc: { kind: "Generated" },
                  metadata: undefined,
                },
                loc: { kind: "Generated" },
                metadata: undefined,
              });
            }
            const nextLinkedFieldNode: LinkedField = {
              ...linkedFieldNode,
              handles: linkedFieldNode.handles?.filter(
                (handle) => handle.name !== "connection"
              ),
              directives: [
                ...linkedFieldNode.directives,
                {
                  kind: "Directive",
                  name: "connection",
                  args,
                  loc: { kind: "Generated" },
                  metadata: undefined,
                },
              ],
            };
            return nextLinkedFieldNode;
          }
        },
      });
      nextContext = nextContext.replace(nextDocument);
    });

    return nextContext;
  };
  return connectionTransformWrapper;
}
