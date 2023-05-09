import { IRTransform } from "relay-compiler/lib/core/CompilerContext";
import { Directive, LinkedField } from "relay-compiler/lib/core/IR";
import { visit } from "relay-compiler/lib/core/IRVisitor";

type PathWithConnectionDirective = [any[], Directive];

/**
 * relay-compiler will strip out all of its client-specific directives, which
 * makes sense as these should normally not be sent to the schema, but in our
 * case we want to keep this directive as we will need to send it to Apollo
 * Client. So we collect all the directives, let the relay-compiler filter
 * transform do its work, and then re-instate the connection directives.
 *
 * @param wrappedFilterDirectivesTransform
 *   relay-compiler's filter directives transform
 */
export function retainConnectionDirectiveTransform(
  wrappedFilterDirectivesTransform: IRTransform,
): IRTransform {
  const filterDirectivesTransformWrapper: IRTransform = (context) => {
    let nextContext = context;
    const documentsWithConnectionDirectives: Record<
      string,
      PathWithConnectionDirective[]
    > = {};

    // Store @connection directives
    nextContext.forEachDocument((document) => {
      const fieldPathsWithConnectionDirectives: PathWithConnectionDirective[] =
        [];
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
      documentsWithConnectionDirectives[document.name] =
        fieldPathsWithConnectionDirectives;
    });

    // Apply original upstream transform
    nextContext = wrappedFilterDirectivesTransform(context);

    // Re-add @connection directives
    nextContext.forEachDocument((document) => {
      const fieldPathsWithConnectionDirectives =
        documentsWithConnectionDirectives[document.name];
      if (fieldPathsWithConnectionDirectives.length > 0) {
        const nextDocument = visit(document, {
          LinkedField(linkedFieldNode, _key, _parent, path) {
            const match = fieldPathsWithConnectionDirectives.find(
              ([p, _]) =>
                path!.length === p.length && path!.every((x, i) => p[i] === x),
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
      }
    });

    return nextContext;
  };
  return filterDirectivesTransformWrapper;
}
