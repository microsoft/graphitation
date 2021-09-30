import ts from "typescript";
import {
  DefinitionNode,
  FragmentDefinitionNode,
  OperationDefinitionNode,
  parse,
  Kind,
} from "graphql";
import { collapseTextChangeRangesAcrossMultipleVersions } from "relay-compiler/node_modules/typescript";
// import astify, { InterpolationNode } from "./astify";

export interface GraphQLTagTransformOptions {
  graphqlTagModuleRegex: RegExp;
}

const DefaultOptions: GraphQLTagTransformOptions = {
  graphqlTagModuleRegex: new RegExp(/^['"]@graphitation\/graphql-js-tag['"]$/),
};

export function getTransformer(
  options: Partial<GraphQLTagTransformOptions>
): ts.TransformerFactory<ts.SourceFile> {
  const fullOptions: GraphQLTagTransformOptions = {
    ...DefaultOptions,
    ...options,
  };

  return (context: ts.TransformationContext): ts.Transformer<ts.SourceFile> => {
    return (sourceFile: ts.SourceFile) =>
      ts.visitNode(sourceFile, getVisitor(fullOptions, context, sourceFile));
  };
}

function getVisitor(
  options: GraphQLTagTransformOptions,
  context: ts.TransformationContext,
  sourceFile: ts.SourceFile
): ts.Visitor {
  const visitor: ts.Visitor = (node: ts.Node): ts.VisitResult<ts.Node> => {
    // `graphql-tag` import declaration detected
    if (ts.isImportDeclaration(node)) {
      const moduleName = (node as ts.ImportDeclaration).moduleSpecifier.getText(
        sourceFile
      );
      if (options.graphqlTagModuleRegex.test(moduleName)) {
        // delete it
        return undefined;
      }
    }

    // tagged template expression detected
    if (ts.isTaggedTemplateExpression(node)) {
      const [tag, template] = node.getChildren();

      const isTemplateExpression = ts.isTemplateExpression(template);
      const isTemplateLiteral = ts.isNoSubstitutionTemplateLiteral(template);

      if (
        tag.getText() === "gql" &&
        (isTemplateExpression || isTemplateLiteral)
      ) {
        const interpolations: ts.VisitResult<ts.Node> = [];

        let source = template.getText().slice(1, -1);

        // `gql` tag with fragment interpolation
        if (isTemplateExpression) {
          collectTemplateInterpolations(template, interpolations, context);

          // remove embed expressions
          source = source.replace(/\$\{(.*)\}/g, "");
        }

        let definitions = getDefinitions(source);

        return createDocument(definitions, interpolations);
      }
    }

    return ts.visitEachChild(node, visitor, context);
  };

  return visitor;
}

function collectTemplateInterpolations(
  node: ts.Node,
  interpolations: Array<ts.Node>,
  context: ts.TransformationContext
): ts.VisitResult<ts.Node> {
  if (ts.isTemplateSpan(node)) {
    const interpolation = node.getChildAt(0);

    if (
      !ts.isIdentifier(interpolation) &&
      !ts.isPropertyAccessExpression(interpolation)
    ) {
      throw new Error(
        "Only identifiers or property access expressions are allowed by this transformer as an interpolation in a GraphQL template literal."
      );
    }

    interpolations.push(interpolation);
  }

  return ts.visitEachChild(
    node,
    (childNode) =>
      collectTemplateInterpolations(childNode, interpolations, context),
    context
  );
}

function getDefinitions(
  source: string
): Array<OperationDefinitionNode | FragmentDefinitionNode> {
  const queryDocument = parse(source, {
    noLocation: true,
  });
  const definitions = [];

  for (const definition of queryDocument.definitions) {
    if (definition.kind === Kind.OPERATION_DEFINITION) {
      if (queryDocument.definitions.length > 1) {
        throw new Error(
          `If a GraphQL query document contains multiple operations, each operation must be named.\n${source}`
        );
      }
      definitions.push(definition);
    } else if (definition.kind === Kind.FRAGMENT_DEFINITION) {
      definitions.push(definition);
    }
  }

  return definitions;
}

function createDocument(
  definitions: Array<OperationDefinitionNode | FragmentDefinitionNode>,
  interpolations: Array<ts.Identifier | ts.PropertyAccessExpression>
): ts.ObjectLiteralExpression {
  const baseDefinitions = ts.factory.createArrayLiteralExpression(
    definitions.map((def) => toAst(def))
  );

  const extraDefinitions = interpolations.map((expr) => {
    return ts.factory.createPropertyAccessExpression(
      expr,
      ts.factory.createIdentifier("definitions")
    );
  });

  const allDefinitions = ts.factory.createCallExpression(
    ts.factory.createPropertyAccessExpression(
      baseDefinitions,
      ts.factory.createIdentifier("concat")
    ),
    undefined,
    extraDefinitions.length
      ? extraDefinitions
      : [ts.factory.createArrayLiteralExpression()]
  );
  return ts.factory.createObjectLiteralExpression([
    ts.factory.createPropertyAssignment(
      "kind",
      ts.factory.createStringLiteral(Kind.DOCUMENT)
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
          literal.map((item) => toAst(item))
        );
      }

      return ts.factory.createObjectLiteralExpression(
        Object.keys(literal).map((k) => {
          return ts.factory.createPropertyAssignment(k, toAst(literal[k]));
        })
      );
  }
}
