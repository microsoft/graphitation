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
          // Because we currently only emit new watch queries for fragments
          // on Node types, we cannot just assume the artefact exists for
          // every fragment definition. So check if it exists before emitting
          // the import.
          //
          // TODO: This file checking should not exist and is probably not
          //       performant.
          //
          // NOTE: In our test case node.getSourceFile() returns undefined.
          let emitImport = true;
          const sourceFile: ts.SourceFile | undefined = node.getSourceFile();
          if (sourceFile) {
            const artefactFile =
              path.join(
                path.dirname(sourceFile.fileName),
                (importDeclaration.moduleSpecifier as ts.StringLiteral).text
              ) + ".ts";
            emitImport = fs.existsSync(artefactFile);
          }
          if (emitImport) {
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
          ts.factory.createNamedImports([
            ts.factory.createImportSpecifier(
              ts.factory.createIdentifier("documents"),
              ts.factory.createIdentifier(namespaceName)
            ),
          ])
        ),
        ts.factory.createStringLiteral(
          `./__generated__/${operationName}.graphql`
        )
      ),
      ts.factory.createIdentifier(namespaceName),
    ];
  } else if (definitionNode.kind === "FragmentDefinition") {
    const queryName = getQueryName(definitionNode);
    const fragmentName = definitionNode.name.value;
    const namespaceName = `${PREFIX}${QUERIES_NAMESPACE}_${fragmentName}`;
    return [
      ts.factory.createImportDeclaration(
        undefined,
        undefined,
        ts.factory.createImportClause(
          false,
          undefined,
          ts.factory.createNamedImports([
            ts.factory.createImportSpecifier(
              ts.factory.createIdentifier("documents"),
              ts.factory.createIdentifier(namespaceName)
            ),
          ])
        ),
        ts.factory.createStringLiteral(`./__generated__/${queryName}.graphql`)
      ),
      ts.factory.createIdentifier(namespaceName),
    ];
  }
  invariant(false, `Unhandled GraphQL definition type: ${definitionNode.kind}`);
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

import { WebpackPluginInstance, Compiler, javascript } from "webpack";
export class ImportDocumentsTransformPlugin implements WebpackPluginInstance {
  apply(compiler: Compiler) {
    compiler.hooks.compilation.tap(
      "ImportDocumentsTransformPlugin",
      (compilation, { normalModuleFactory }) => {
        const handler = (parser: javascript.JavascriptParser) => {
          parser.hooks.program.tap("ImportDocumentsTransformPlugin", (ast) => {
            const firstNode = ast.body[0];
            if (
              firstNode &&
              firstNode.type === "ExpressionStatement" &&
              firstNode.expression.type === "Literal" &&
              firstNode.expression.value === "use strict"
            ) {
              // Remove "use strict" expression. It will be added later by the renderer again.
              // This is necessary in order to not break the strict mode when webpack prepends code.
              // @see https://github.com/webpack/webpack/issues/1970
              // const dep = new ConstDependency("", firstNode.range);
              // dep.loc = firstNode.loc;
              // parser.state.current.addDependency(dep);
              // parser.state.module.buildInfo.strict = true;
            }
          });
          parser.hooks.statement.tap(
            "ImportDocumentsTransformPlugin",
            (ast) => {
              if (
                ast.type === "ExpressionStatement" &&
                (ast.expression.type === "TaggedTemplateExpression" ||
                  ast.expression.type === "Identifier")
              ) {
                console.log(ast.expression);
              }
            }
          );
        };

        normalModuleFactory.hooks.parser
          .for("javascript/auto")
          .tap("UseStrictPlugin", handler);
        normalModuleFactory.hooks.parser
          .for("javascript/dynamic")
          .tap("UseStrictPlugin", handler);
        normalModuleFactory.hooks.parser
          .for("javascript/esm")
          .tap("UseStrictPlugin", handler);
      }
    );
  }
}
