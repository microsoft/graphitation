import { parse } from "graphql";
import type { DocumentNode } from "graphql";
import invariant from "invariant";

/**
 * This tagged template function is used to capture a single GraphQL document, such as an operation or a fragment. When
 * a document refers to fragments, those should be interpolated as trailing components, but *no* other interpolation is
 * allowed. Put differently, the documents themselves should be entirely static, which allows for static optimizations.
 * 
 * Documents will be de-duped, in case multiple documents refer to the same fragment(s).
 * 
 * For memory optimization, appended documents are copied by reference rather than by value. Similarly, the document
 * de-duping is done by reference, not by (deep) value; a tool that ensures documents are unique and defined only once
 * should be able to ensure that these fragments cannot semantically be different.
 * 
 * @note
 * 
 * Be aware that this parses the documents *at runtime*. When this is no longer appropriate, a build-step should be
 * introduced that parses the documents ahead-of-time and replaces the inline document with the AST nodes.
 * 
 * Additionally, an `invariant` check can safely be removed for production builds.
 *
 * @example
 *
 ```ts
 const id = 42
 const FooFragment = graphql`
   fragment FooFragment on Bar {
     # This is BAD interpolation
     foo(id: ${id})
   }
 `
 const FooQuery = graphql`
   query FooQuery {
     ...FooFragment
   }
    # This is GOOD interpolation
   ${FooFragment}
 `
 ```
 *
 * @param strings
 */
export function graphql(
  document: TemplateStringsArray,
  ...fragments: DocumentNode[]
): DocumentNode {
  invariant(
    document.map((s) => s.trim()).filter((s) => s.length > 0).length === 1,
    "Interpolations are only allowed at the end of the template."
  );
  const documentNode = parse(document[0]);
  const definitions = new Set(documentNode.definitions);
  fragments.forEach((doc) =>
    doc.definitions.forEach((def) => definitions.add(def))
  );
  return { kind: "Document", definitions: Array.from(definitions) };
}
