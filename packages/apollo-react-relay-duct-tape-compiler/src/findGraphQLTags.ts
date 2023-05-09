/**
 * Taken from https://github.com/relay-tools/relay-compiler-language-typescript/blob/b186ac3d9d9682949638211c3126c015f8706b0f/src/FindGraphQLTags.ts
 * License: MIT
 * Copyright 2018 Kaare Hoff Skovgaard kaare@kaareskovgaard.net, Eloy Durán eloy.de.enige@gmail.com
 */

import * as ts from "typescript";
import {
  GraphQLTag,
  GraphQLTagFinder,
} from "relay-compiler/lib/language/RelayLanguagePluginInterface";
// import { rewriteGraphitationDirectives } from "./rewriteGraphitationDirectives";

/**
 * @note Difference from the TS language plugin is that we only support hooks, so no need for HOCs.
 */
function visit(node: ts.Node, addGraphQLTag: (tag: GraphQLTag) => void): void {
  function visitNode(node: ts.Node) {
    switch (node.kind) {
      case ts.SyntaxKind.TaggedTemplateExpression: {
        const taggedTemplate = node as ts.TaggedTemplateExpression;
        if (isGraphQLTag(taggedTemplate.tag)) {
          // TODO: This code previously had no validation and thus no
          //       keyName/sourceLocationOffset. Are these right?
          addGraphQLTag({
            keyName: null,
            template: getGraphQLText(taggedTemplate),
            sourceLocationOffset: getSourceLocationOffset(taggedTemplate),
          });
        }
      }
    }
    ts.forEachChild(node, visitNode);
  }

  visitNode(node);
}

function isGraphQLTag(tag: ts.Node): boolean {
  return (
    tag.kind === ts.SyntaxKind.Identifier &&
    (tag as ts.Identifier).text === "graphql"
  );
}

/**
 * @note The difference here is that we do allow substitutions, but only in the trailing part, so we always return the
 *       head. This might lead to a bad DX when the user does allow substitution in the document part and receiving
 *       hard to understand errors, but seeing as this is meant as temporary solution it may be a worthwhile trade-off.
 */
function getTemplateNode(quasi: ts.TaggedTemplateExpression) {
  if (quasi.template.kind === ts.SyntaxKind.TemplateExpression) {
    return quasi.template.head;
  }
  return quasi.template;
}

/**
 * @note The difference here is that we rewrite graphitation specific directives to relay ones.
 */
function getGraphQLText(quasi: ts.TaggedTemplateExpression) {
  // return rewriteGraphitationDirectives(getTemplateNode(quasi).text);
  return getTemplateNode(quasi).text;
}

function getSourceLocationOffset(quasi: ts.TaggedTemplateExpression) {
  const pos = getTemplateNode(quasi).pos;
  const loc = quasi.getSourceFile().getLineAndCharacterOfPosition(pos);
  return {
    line: loc.line + 1,
    column: loc.character + 1,
  };
}

export const find: GraphQLTagFinder = (text, filePath) => {
  const result: GraphQLTag[] = [];
  const ast = ts.createSourceFile(filePath, text, ts.ScriptTarget.Latest, true);
  visit(ast, (tag) => result.push(tag));
  return result;
};
