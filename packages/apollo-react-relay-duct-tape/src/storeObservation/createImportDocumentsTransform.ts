/**
 * TODO:
 * - Don't hardcode identifiers but check if they're aliased from their imports.
 * - Support mutations and subscriptions
 * - Properly emit errors from transformer, is invariant ok?
 */

import invariant from "invariant";
import * as ts from "typescript";
import { parse as parseGraphQL } from "graphql";
import * as path from "path";
import * as fs from "fs";

const PREFIX = "__graphitation_";
const QUERIES_NAMESPACE = "generatedQueries";

export function createImportDocumentsTransform(): ts.TransformerFactory<ts.SourceFile> {
  return (context: ts.TransformationContext): ts.Transformer<ts.SourceFile> => {
    const imports: ts.ImportDeclaration[] = [];

    const visitor: ts.Visitor = (node: ts.Node): ts.VisitResult<ts.Node> => {
      if (
        ts.isTaggedTemplateExpression(node) &&
        ts.isIdentifier(node.tag) &&
        node.tag.escapedText === "graphql"
      ) {
        const documentNodes = createGraphQLDocumentNodes(node);
        if (documentNodes) {
          const [importDeclaration, replacementNode] = documentNodes;
          // TODO: This file checking should not exist and is probably not performant.
          const artefactFile =
            path.join(
              path.dirname(node.getSourceFile().fileName),
              (importDeclaration.moduleSpecifier as ts.StringLiteral).text
            ) + ".ts";
          if (fs.existsSync(artefactFile)) {
            imports.push(importDeclaration);
            return replacementNode;
          }
        }
      }
      return ts.visitEachChild(node, visitor, context);
    };

    return (sourceFile: ts.SourceFile) => {
      const outputSourceFile = ts.visitNode(sourceFile, visitor);
      return ts.factory.updateSourceFile(outputSourceFile, [
        ...imports,
        ...outputSourceFile.statements,
      ]);
    };
  };
}

function createGraphQLDocumentNodes(
  graphqlTagTemplateNode: ts.TaggedTemplateExpression
): [ts.ImportDeclaration, ts.Identifier] | undefined {
  const graphqlDoc = ts.isNoSubstitutionTemplateLiteral(
    graphqlTagTemplateNode.template
  )
    ? graphqlTagTemplateNode.template.rawText
    : graphqlTagTemplateNode.template.head.rawText;
  invariant(graphqlDoc, "Expected a GraphQL document");
  const graphqlAST = parseGraphQL(graphqlDoc);
  const definitionNode = graphqlAST.definitions[0];
  if (definitionNode.kind === "OperationDefinition") {
    if (definitionNode.operation !== "query") {
      return undefined;
    }
    const operationName = definitionNode.name?.value;
    invariant(operationName, "Operations are required to have a name");
    const namespaceName = `${PREFIX}${QUERIES_NAMESPACE}_${operationName}`;
    return [
      ts.factory.createImportDeclaration(
        undefined,
        undefined,
        ts.factory.createImportClause(
          false,
          undefined,
          ts.factory.createNamespaceImport(
            ts.factory.createIdentifier(namespaceName)
          )
        ),
        ts.factory.createStringLiteral(
          `./__generated__/${operationName}.graphql`
        )
      ),
      ts.factory.createIdentifier(namespaceName),
    ];
  } else if (definitionNode.kind === "FragmentDefinition") {
    const fragmentName = definitionNode.name.value;
    const fragmentBaseName = fragmentName.replace(/Fragment$/, "");
    const namespaceName = `${PREFIX}${QUERIES_NAMESPACE}_${fragmentName}`;
    return [
      ts.factory.createImportDeclaration(
        undefined,
        undefined,
        ts.factory.createImportClause(
          false,
          undefined,
          ts.factory.createNamespaceImport(
            ts.factory.createIdentifier(namespaceName)
          )
        ),
        ts.factory.createStringLiteral(
          `./__generated__/${fragmentBaseName}WatchNodeQuery.graphql`
        )
      ),
      ts.factory.createIdentifier(namespaceName),
    ];
  }
  invariant(false, `Unhandled GraphQL definition type: ${definitionNode.kind}`);
}
