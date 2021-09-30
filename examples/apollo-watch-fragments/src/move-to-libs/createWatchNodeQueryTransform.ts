import * as ts from "typescript";

// TODO: Don't hardcode identifiers but check if they're aliased from their imports.
export function createWatchNodeQueryTransform(): ts.TransformerFactory<ts.SourceFile> {
  return (context: ts.TransformationContext): ts.Transformer<ts.SourceFile> => {
    const imports: ts.ImportDeclaration[] = [];

    const visitor: ts.Visitor = (node: ts.Node): ts.VisitResult<ts.Node> => {
      if (ts.isCallExpression(node) && ts.isIdentifier(node.expression)) {
        if (node.expression.escapedText === "useLazyLoadQuery") {
          const hook = "__graphitation_useExecuteAndWatchQuery";
          const queriesNamespace = "__graphitationGeneratedQueries";

          imports.push(
            ts.factory.createImportDeclaration(
              undefined,
              undefined,
              ts.factory.createImportClause(
                false,
                undefined,
                ts.factory.createNamedImports([
                  ts.factory.createImportSpecifier(
                    ts.factory.createIdentifier("useExecuteAndWatchQuery"),
                    ts.factory.createIdentifier(hook)
                  ),
                ])
              ),
              ts.factory.createStringLiteral(
                "./move-to-libs/useExecuteAndWatchQuery"
              )
            )
          );
          imports.push(
            ts.factory.createImportDeclaration(
              undefined,
              undefined,
              ts.factory.createImportClause(
                false,
                undefined,
                ts.factory.createNamespaceImport(
                  ts.factory.createIdentifier(queriesNamespace)
                )
              ),
              ts.factory.createStringLiteral("./__generated__/AppQuery.graphql")
            )
          );

          return ts.factory.updateCallExpression(
            node,
            ts.factory.createIdentifier(hook),
            undefined,
            [
              ts.factory.createPropertyAccessExpression(
                ts.factory.createIdentifier(queriesNamespace),
                ts.factory.createIdentifier("executionQueryDocument")
              ),
              ts.factory.createPropertyAccessExpression(
                ts.factory.createIdentifier(queriesNamespace),
                ts.factory.createIdentifier("watchQueryDocument")
              ),
              node.arguments[1],
            ]
          );
        }
      }
      return ts.visitEachChild(node, visitor, context);
    };

    return (sourceFile: ts.SourceFile) => {
      let outputSourceFile = ts.visitNode(sourceFile, visitor);

      outputSourceFile = ts.factory.updateSourceFile(outputSourceFile, [
        ...imports,
        ...outputSourceFile.statements,
      ]);

      if (sourceFile.fileName.endsWith("/App.tsx")) {
        // console.log(imports);
        // console.log(
        //   outputSourceFile.statements
        //     .filter((statement) => ts.isImportDeclaration(statement))
        //     .map((imp) => (imp as any).moduleSpecifier.text)
        // );
        const printer = ts.createPrinter();
        console.log(printer.printFile(outputSourceFile));
      }

      return outputSourceFile;
    };
  };
}
