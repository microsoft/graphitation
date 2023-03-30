import ts from "typescript";
import {
  FragmentDefinitionNode,
  OperationDefinitionNode,
  parse,
  Kind,
} from "graphql";

interface GraphQLTagTransformContext {
  graphqlTagModuleRegexp: RegExp;
  graphqlTagModuleExport: string;
  transformer?: (
    node: FragmentDefinitionNode | OperationDefinitionNode,
  ) => unknown;
}
export interface GraphQLTagTransformOptions {
  graphqlTagModule?: string;
  graphqlTagModuleExport?: "default" | string;
  transformer?: (
    node: FragmentDefinitionNode | OperationDefinitionNode,
  ) => unknown;
}

const DefaultContext: GraphQLTagTransformContext = {
  graphqlTagModuleRegexp: new RegExp(/^['"]@graphitation\/graphql-js-tag['"]$/),
  graphqlTagModuleExport: "graphql",
};

export function getTransformer(
  options: Partial<GraphQLTagTransformOptions>,
): ts.TransformerFactory<ts.SourceFile> {
  const transformerContext = createTransformerContext(options);
  return (context: ts.TransformationContext): ts.Transformer<ts.SourceFile> => {
    return (sourceFile: ts.SourceFile) =>
      ts.visitNode(
        sourceFile,
        getVisitor(transformerContext, context, sourceFile),
      );
  };
}

export function createTransformerContext(
  options: GraphQLTagTransformOptions,
): GraphQLTagTransformContext {
  const context: GraphQLTagTransformContext = {
    ...DefaultContext,
  };
  const moduleRegexp = options.graphqlTagModule
    ? new RegExp(`^['"]${options.graphqlTagModule}['"]$`)
    : null;

  if (moduleRegexp) {
    context.graphqlTagModuleRegexp = moduleRegexp;
  }

  if (options.graphqlTagModuleExport) {
    context.graphqlTagModuleExport = options.graphqlTagModuleExport;
  }

  context.transformer = options.transformer;

  return context;
}

function getVisitor(
  transformerContext: GraphQLTagTransformContext,
  context: ts.TransformationContext,
  sourceFile: ts.SourceFile,
): ts.Visitor {
  let templateLiteralName: string | null = null;
  const visitor: ts.Visitor = (node: ts.Node): ts.VisitResult<ts.Node> => {
    // `graphql-tag` import declaration detected
    if (ts.isImportDeclaration(node)) {
      const moduleName = (node as ts.ImportDeclaration).moduleSpecifier.getText(
        sourceFile,
      );
      // here we want to remove export, but only if there are no other exports. if there are other exports
      // we remove only the one we need. Logic is complex cause tag can be default or not-default export
      if (
        transformerContext.graphqlTagModuleRegexp.test(moduleName) &&
        node.importClause
      ) {
        if (transformerContext.graphqlTagModuleExport === "default") {
          if (node.importClause.name) {
            templateLiteralName = node.importClause.name.text;
            if (node.importClause.namedBindings) {
              return ts.factory.createImportDeclaration(
                node.decorators,
                node.modifiers,
                ts.factory.updateImportClause(
                  node.importClause,
                  node.importClause.isTypeOnly,
                  undefined,
                  node.importClause.namedBindings,
                ),
                node.moduleSpecifier,
              );
            } else {
              return undefined;
            }
          }
        } else {
          const newImportSpecifiers: Array<ts.ImportSpecifier> = [];
          if (node.importClause.namedBindings) {
            if (ts.isNamedImports(node.importClause.namedBindings)) {
              const importSpecifiers = node.importClause.namedBindings.elements;
              for (const importSpecifier of importSpecifiers) {
                if (
                  importSpecifier.name.text ===
                  transformerContext.graphqlTagModuleExport
                ) {
                  templateLiteralName = importSpecifier.propertyName
                    ? importSpecifier.propertyName.text
                    : importSpecifier.name.text;
                } else {
                  newImportSpecifiers.push(importSpecifier);
                }
              }
            } else {
              throw new Error("Namespace imports are not supported");
            }
          }
          if (newImportSpecifiers.length || node.importClause.name) {
            const result = ts.factory.updateImportDeclaration(
              node,
              node.modifiers,
              ts.factory.updateImportClause(
                node.importClause,
                node.importClause.isTypeOnly,
                node.importClause.name,
                node.importClause.namedBindings && newImportSpecifiers.length
                  ? ts.factory.updateNamedImports(
                      node.importClause.namedBindings,
                      newImportSpecifiers,
                    )
                  : undefined,
              ),
              node.moduleSpecifier,
              node.assertClause,
            );
            return result;
          } else {
            return undefined;
          }
        }
      }
    }

    // tagged template expression detected
    if (ts.isTaggedTemplateExpression(node)) {
      const [tag, template] = node.getChildren();

      const isTemplateExpression = ts.isTemplateExpression(template);
      const isTemplateLiteral = ts.isNoSubstitutionTemplateLiteral(template);

      if (
        tag.getText() === templateLiteralName &&
        (isTemplateExpression || isTemplateLiteral)
      ) {
        let source = template.getText().slice(1, -1);

        let interpolations: Array<ts.Identifier | ts.PropertyAccessExpression> =
          [];
        // `gql` tag with fragment interpolation
        if (isTemplateExpression) {
          interpolations = collectTemplateInterpolations(template, context);

          // remove embed expressions
          source = source.replace(/\$\{(.*)\}/g, "");
        }

        let definitions = getDefinitions(
          source,
          transformerContext.transformer,
        );

        return createDocument(definitions, interpolations);
      }
    }

    return ts.visitEachChild(node, visitor, context);
  };

  return visitor;
}

function collectTemplateInterpolations(
  node: ts.Node,
  context: ts.TransformationContext,
): Array<ts.Identifier | ts.PropertyAccessExpression> {
  const interpolations: Array<ts.Identifier | ts.PropertyAccessExpression> = [];
  function collectTemplateInterpolationsImpl(
    node: ts.Node,
    context: ts.TransformationContext,
  ): ts.Node {
    if (ts.isTemplateSpan(node)) {
      const interpolation = node.getChildAt(0);

      if (
        !ts.isIdentifier(interpolation) &&
        !ts.isPropertyAccessExpression(interpolation)
      ) {
        throw new Error(
          "Only identifiers or property access expressions are allowed by this transformer as an interpolation in a GraphQL template literal.",
        );
      }

      interpolations.push(interpolation);
    }

    return ts.visitEachChild(
      node,
      (childNode) => collectTemplateInterpolationsImpl(childNode, context),
      context,
    );
  }
  collectTemplateInterpolationsImpl(node, context);
  return interpolations;
}

function getDefinitions(
  source: string,
  transformer: GraphQLTagTransformContext["transformer"] | undefined,
): Array<unknown> {
  const queryDocument = parse(source, {
    noLocation: true,
  });
  const definitions = [];

  for (const definition of queryDocument.definitions) {
    if (definition.kind === Kind.OPERATION_DEFINITION) {
      if (queryDocument.definitions.length > 1) {
        throw new Error(
          `If a GraphQL query document contains multiple operations, each operation must be named.\n${source}`,
        );
      }
      definitions.push(transformer ? transformer(definition) : definition);
    } else if (definition.kind === Kind.FRAGMENT_DEFINITION) {
      definitions.push(transformer ? transformer(definition) : definition);
    }
  }

  return definitions;
}

function createDocument(
  definitions: Array<unknown>,
  interpolations: Array<ts.Identifier | ts.PropertyAccessExpression>,
): ts.ObjectLiteralExpression {
  const baseDefinitions = ts.factory.createArrayLiteralExpression(
    definitions.map((def) => toAst(def)),
  );

  const extraDefinitions = interpolations.map((expr) => {
    return ts.factory.createPropertyAccessExpression(
      expr,
      ts.factory.createIdentifier("definitions"),
    );
  });

  const allDefinitions = ts.factory.createCallExpression(
    ts.factory.createPropertyAccessExpression(
      baseDefinitions,
      ts.factory.createIdentifier("concat"),
    ),
    undefined,
    extraDefinitions.length
      ? extraDefinitions
      : [ts.factory.createArrayLiteralExpression()],
  );

  return ts.factory.createObjectLiteralExpression([
    ts.factory.createPropertyAssignment(
      "kind",
      ts.factory.createStringLiteral(Kind.DOCUMENT),
    ),
    ts.factory.createPropertyAssignment("definitions", allDefinitions),
  ]);
}

function toAst(literal: any): ts.Expression {
  if (literal === null) {
    return ts.factory.createNull();
  }

  switch (typeof literal) {
    case "function":
      throw new Error("`function` is the wrong type in JSON.");
    case "string":
      return ts.factory.createStringLiteral(literal);
    case "number":
      return ts.factory.createNumericLiteral(literal);
    case "boolean":
      return literal ? ts.factory.createTrue() : ts.factory.createFalse();
    case "undefined":
      return ts.factory.createIdentifier("undefined");
    default:
      if (Array.isArray(literal)) {
        return ts.factory.createArrayLiteralExpression(
          literal.map((item) => toAst(item)),
        );
      }

      return ts.factory.createObjectLiteralExpression(
        Object.keys(literal).map((k) => {
          return ts.factory.createPropertyAssignment(k, toAst(literal[k]));
        }),
      );
  }
}
