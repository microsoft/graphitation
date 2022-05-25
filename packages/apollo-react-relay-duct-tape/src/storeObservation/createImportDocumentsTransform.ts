/**
 * TODO:
 * - Don't hardcode identifiers but check if they're aliased from their imports.
 * - Support mutations and subscriptions
 * - Properly emit errors from transformer, is invariant ok?
 */

import invariant from "invariant";
import * as ts from "typescript";
import {
  FragmentDefinitionNode,
  parse as parseGraphQL,
  StringValueNode,
} from "graphql";
import * as path from "path";
import * as fs from "fs";

const PREFIX = "__graphitation_";
const QUERIES_NAMESPACE = "generatedQueries";

export function createImportDocumentsTransform(): ts.TransformerFactory<ts.SourceFile> {
  return (context: ts.TransformationContext): ts.Transformer<ts.SourceFile> => {
    const imports: ts.Statement[] = [];

    const visitor: ts.Visitor = (node: ts.Node): ts.VisitResult<ts.Node> => {
      if (
        ts.isTaggedTemplateExpression(node) &&
        ts.isIdentifier(node.tag) &&
        node.tag.escapedText === "graphql"
      ) {
        const documentNodes = createGraphQLDocumentNodes(
          node,
          context.getCompilerOptions().module
        );
        if (documentNodes) {
          const [modulePath, importStatement, replacementNode] = documentNodes;
          // Because we currently only emit new watch queries for fragments
          // on Node types, we cannot just assume the artefact exists for
          // every fragment definition. So check if it exists before emitting
          // the import.
          //
          // TODO: This file checking should not exist and is probably not
          //       performant.
          const artefactFile =
            path.join(
              path.dirname(node.getSourceFile().fileName),
              modulePath.text
            ) + ".ts";
          const emitImport = fs.existsSync(artefactFile);
          if (emitImport) {
            imports.push(importStatement);
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
  graphqlTagTemplateNode: ts.TaggedTemplateExpression,
  moduleKind: ts.ModuleKind = ts.ModuleKind.ES2015
):
  | [
      modulePath: ts.StringLiteral,
      importStatement: ts.Statement,
      importReference: ts.Identifier
    ]
  | undefined {
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
    const modulePath = createModulePathNode(operationName);
    return [
      modulePath,
      createImportStatement(moduleKind, namespaceName, modulePath),
      ts.factory.createIdentifier(namespaceName),
    ];
  } else if (definitionNode.kind === "FragmentDefinition") {
    const queryName = getQueryName(definitionNode);
    const fragmentName = definitionNode.name.value;
    const namespaceName = `${PREFIX}${QUERIES_NAMESPACE}_${fragmentName}`;
    const modulePath = createModulePathNode(queryName);
    return [
      modulePath,
      createImportStatement(moduleKind, namespaceName, modulePath),
      ts.factory.createIdentifier(namespaceName),
    ];
  }
  invariant(false, `Unhandled GraphQL definition type: ${definitionNode.kind}`);
}

function createModulePathNode(baseName: string) {
  return ts.factory.createStringLiteral(`./__generated__/${baseName}.graphql`);
}

function createImportStatement(
  moduleKind: ts.ModuleKind,
  namespaceName: string,
  modulePath: ts.StringLiteral
): ts.Statement {
  if (moduleKind === ts.ModuleKind.CommonJS) {
    return ts.factory.createVariableStatement(
      undefined,
      ts.factory.createVariableDeclarationList([
        ts.factory.createVariableDeclaration(
          namespaceName,
          undefined,
          undefined,
          ts.factory.createPropertyAccessExpression(
            ts.factory.createCallExpression(
              ts.factory.createIdentifier("require"),
              [],
              [modulePath]
            ),
            ts.factory.createIdentifier("documents")
          )
        ),
      ])
    );
  } else {
    return ts.factory.createImportDeclaration(
      undefined,
      undefined,
      ts.factory.createImportClause(
        false,
        undefined,
        ts.factory.createNamedImports([
          ts.factory.createImportSpecifier(
            false,
            ts.factory.createIdentifier("documents"),
            ts.factory.createIdentifier(namespaceName)
          ),
        ])
      ),
      modulePath
    );
  }
}

function getQueryName(definitionNode: FragmentDefinitionNode) {
  const refetchableQueryNameNode = definitionNode.directives
    ?.find((directive) => directive.name.value === "refetchable")
    ?.arguments?.find((arg) => arg.name.value === "queryName")?.value as
    | StringValueNode
    | undefined;
  if (refetchableQueryNameNode) {
    return refetchableQueryNameNode.value;
  } else {
    const fragmentName = definitionNode.name.value;
    const fragmentBaseName = fragmentName.replace(/Fragment$/, "");
    return `${fragmentBaseName}WatchNodeQuery`;
  }
}
