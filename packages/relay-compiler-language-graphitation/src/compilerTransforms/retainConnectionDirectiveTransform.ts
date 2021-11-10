import { IRTransform } from "relay-compiler/lib/core/CompilerContext";
import { Directive, LinkedField } from "relay-compiler/lib/core/IR";
import { visit } from "relay-compiler/lib/core/IRVisitor";

export function retainConnectionDirectiveTransform(
  wrappedFilterDirectivesTransform: IRTransform
): IRTransform {
  const filterDirectivesTransformWrapper: IRTransform = (context) => {
    let nextContext = context;
    const fieldPathsWithConnectionDirectives: [any[], Directive][] = [];

    // Store @connection directives
    nextContext.forEachDocument((document) => {
      visit(document, {
        Directive(directiveNode, _key, _parent, path) {
          if (directiveNode.name === "connection") {
            fieldPathsWithConnectionDirectives.push([
              path!.slice(0, -2),
              directiveNode,
            ]);
          }
        },
      });
    });

    // Apply original upstream transform
    nextContext = wrappedFilterDirectivesTransform(context);

    // Re-add @connection directives
    if (fieldPathsWithConnectionDirectives.length > 0) {
      nextContext.forEachDocument((document) => {
        const nextDocument = visit(document, {
          LinkedField(linkedFieldNode, _key, _parent, path) {
            const match = fieldPathsWithConnectionDirectives.find(
              ([p, _]) =>
                path!.length === p.length && path!.every((x, i) => p[i] === x)
            );
            if (match) {
              const nextLinkedFieldNode: LinkedField = {
                ...linkedFieldNode,
                directives: [...linkedFieldNode.directives, match[1]],
              };
              return nextLinkedFieldNode;
            }
          },
        });
        nextContext = nextContext.replace(nextDocument);
      });
    }

    return nextContext;
  };
  return filterDirectivesTransformWrapper;
}
