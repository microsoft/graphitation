import ts from "typescript";
import {
  FragmentDefinitionNode,
  OperationDefinitionNode,
  parse,
  Kind,
} from "graphql";

type TaggedTemplateTransformer = (
  source: string,
  transformerContext: GraphQLTagTransformContext,
  interpolations: (ts.Identifier | ts.PropertyAccessExpression)[],
) => ts.Expression;

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
    return (sourceFile: ts.SourceFile) => {
      // First pass: analyze usage
      const analysis = analyzeSourceFile(sourceFile, transformerContext);
      
      // Second pass: transform with analysis information
      return ts.visitEachChild(
        sourceFile,
        getVisitor(
          transformerContext,
          context,
          sourceFile,
          inlineAstTaggedTemplateTransformer,
          analysis,
        ),
        context,
      );
    };
  };
}

export function getRelayTransformer(
  options: Partial<GraphQLTagTransformOptions>,
) {
  const transformerContext = createTransformerContext(options);
  return (context: ts.TransformationContext): ts.Transformer<ts.SourceFile> => {
    return (sourceFile: ts.SourceFile) =>
      ts.visitEachChild(
        sourceFile,
        getRelayVisitor(transformerContext, context, sourceFile),
        context,
      );
  };
}

export function getArtefactImportTransformer(
  options: Partial<Omit<GraphQLTagTransformOptions, "transformer">>,
): ts.TransformerFactory<ts.SourceFile> {
  const transformerContext = createTransformerContext(options);
  return (context: ts.TransformationContext): ts.Transformer<ts.SourceFile> => {
    return (sourceFile: ts.SourceFile) => {
      const analysis = analyzeSourceFile(sourceFile, transformerContext);
      const importDeclarations: ts.ImportDeclaration[] = [];
      const outputSourceFile = ts.visitEachChild(
        sourceFile,
        getVisitor(
          transformerContext,
          context,
          sourceFile,
          getImportArtefactTaggedTemplateTransformer(importDeclarations),
          analysis,
        ),
        context,
      );
      if (importDeclarations.length > 0) {
        return ts.factory.updateSourceFile(outputSourceFile, [
          ...importDeclarations,
          ...outputSourceFile.statements,
        ]);
      } else {
        return sourceFile;
      }
    };
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

interface NamespaceAnalysis {
  namespaceImports: Map<string, ts.ImportDeclaration>; // namespace name -> import node
  namespaceUsage: Set<string>; // namespace names that are used for non-graphql properties
  graphqlTagUsage: Set<string>; // template literal names that are used
}

function analyzeSourceFile(sourceFile: ts.SourceFile, transformerContext: GraphQLTagTransformContext): NamespaceAnalysis {
  const analysis: NamespaceAnalysis = {
    namespaceImports: new Map(),
    namespaceUsage: new Set(),
    graphqlTagUsage: new Set()
  };

  function analyze(node: ts.Node): void {
    // Check for namespace imports
    if (ts.isImportDeclaration(node)) {
      const moduleName = node.moduleSpecifier.getText(sourceFile);
      if (transformerContext.graphqlTagModuleRegexp.test(moduleName) && 
          node.importClause?.namedBindings && 
          ts.isNamespaceImport(node.importClause.namedBindings)) {
        const namespaceName = node.importClause.namedBindings.name.text;
        analysis.namespaceImports.set(namespaceName, node);
      }
    }
    
    // Check for tagged template expressions
    if (ts.isTaggedTemplateExpression(node)) {
      const tag = node.tag;
      const tagText = tag.getText();
      
      // Check if this is a namespace.graphql usage
      if (ts.isPropertyAccessExpression(tag)) {
        const namespaceText = tag.expression.getText();
        const propertyText = tag.name.text;
        if (analysis.namespaceImports.has(namespaceText) && 
            propertyText === transformerContext.graphqlTagModuleExport) {
          analysis.graphqlTagUsage.add(tagText);
        }
      } else {
        // Direct import usage
        analysis.graphqlTagUsage.add(tagText);
      }
    }
    
    // Check for other namespace property access
    if (ts.isPropertyAccessExpression(node)) {
      const namespaceText = node.expression.getText();
      const propertyText = node.name.text;
      
      if (analysis.namespaceImports.has(namespaceText) && 
          propertyText !== transformerContext.graphqlTagModuleExport) {
        analysis.namespaceUsage.add(namespaceText);
      }
    }
    
    ts.forEachChild(node, analyze);
  }
  
  analyze(sourceFile);
  return analysis;
}

function getVisitor(
  transformerContext: GraphQLTagTransformContext,
  context: ts.TransformationContext,
  sourceFile: ts.SourceFile,
  applyTaggedTemplateTransformer: TaggedTemplateTransformer,
  analysis: NamespaceAnalysis,
): ts.Visitor {
  let templateLiteralName: string | null = null;
  
  const visitor: ts.Visitor = (
    node: ts.Node,
  ): ts.VisitResult<ts.Node> | undefined => {
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
                node.modifiers,
                ts.factory.updateImportClause(
                  node.importClause,
                  node.importClause.isTypeOnly,
                  undefined,
                  node.importClause.namedBindings,
                ),
                node.moduleSpecifier,
                node.assertClause,
              );
            } else {
              return undefined;
            }
          }
        }
        
        // Handle named imports and namespace imports
        if (node.importClause.namedBindings) {
          if (ts.isNamedImports(node.importClause.namedBindings)) {
            const newImportSpecifiers: Array<ts.ImportSpecifier> = [];
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
          } else if (ts.isNamespaceImport(node.importClause.namedBindings)) {
            // Handle namespace imports like: import * as GraphQLTag from "module"
            const namespaceIdentifier = node.importClause.namedBindings.name.text;
            templateLiteralName = `${namespaceIdentifier}.${transformerContext.graphqlTagModuleExport}`;
            
            // Decide whether to keep the namespace import based on analysis
            const hasNonGraphqlUsage = analysis.namespaceUsage.has(namespaceIdentifier);
            const hasGraphqlUsage = analysis.graphqlTagUsage.has(templateLiteralName);
            
            if (hasNonGraphqlUsage) {
              // Keep the import because other properties are used
              return node;
            } else if (hasGraphqlUsage) {
              // Remove the import because only graphql tag is used and it gets transformed
              return undefined;
            } else {
              // No usage at all, remove the import
              return undefined;
            }
          }
        }
      }
    }

    // tagged template expression detected
    if (ts.isTaggedTemplateExpression(node)) {
      const [tag, template] = node.getChildren();

      const isTemplateExpression = ts.isTemplateExpression(template);
      const isTemplateLiteral = ts.isNoSubstitutionTemplateLiteral(template);

      const tagText = tag.getText();
      
      if (
        tagText === templateLiteralName &&
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

        return applyTaggedTemplateTransformer(
          source,
          transformerContext,
          interpolations,
        );
      }
    }

    return ts.visitEachChild(node, visitor, context);
  };

  return visitor;
}

function inlineAstTaggedTemplateTransformer(
  source: string,
  transformerContext: GraphQLTagTransformContext,
  interpolations: (ts.Identifier | ts.PropertyAccessExpression)[],
) {
  const definitions = getDefinitions(source, transformerContext.transformer);

  return createDocument(definitions, interpolations);
}

function getRelayVisitor(
  transformerContext: GraphQLTagTransformContext,
  context: ts.TransformationContext,
  _sourceFile: ts.SourceFile,
) {
  const nodeVisitor: ts.Visitor = (node: ts.Node): ts.VisitResult<ts.Node> => {
    if (ts.isObjectLiteralExpression(node)) {
      if (
        node.properties.findIndex((p) => {
          return (
            ts.isPropertyAssignment(p) &&
            ts.isStringLiteral(p.name) &&
            p.name.text === "kind" &&
            ts.isStringLiteral(p.initializer) &&
            p.initializer.text === "Request"
          );
        }) !== -1
      ) {
        const params = node.properties.find(
          (p) =>
            ts.isPropertyAssignment(p) &&
            ts.isStringLiteral(p.name) &&
            p.name.text === "params",
        );
        if (params && ts.isPropertyAssignment(params)) {
          const paramsObject = params.initializer;
          if (ts.isObjectLiteralExpression(paramsObject)) {
            const text = paramsObject.properties.find(
              (p) =>
                ts.isPropertyAssignment(p) &&
                ts.isStringLiteral(p.name) &&
                p.name.text === "text",
            );
            if (
              text &&
              ts.isPropertyAssignment(text) &&
              ts.isStringLiteral(text.initializer)
            ) {
              const definitions = getDefinitions(
                text.initializer.text,
                transformerContext.transformer,
              );

              const newText = ts.factory.updatePropertyAssignment(
                text,
                text.name,
                createDocument(definitions, []),
              );
              const newParamsObject = ts.factory.updateObjectLiteralExpression(
                paramsObject,
                paramsObject.properties
                  .filter(
                    (p) =>
                      !ts.isPropertyAssignment(p) ||
                      !ts.isStringLiteral(p.name) ||
                      p.name.text !== "text",
                  )
                  .concat([newText]),
              );
              const newParams = ts.factory.updatePropertyAssignment(
                params,
                params.name,
                newParamsObject,
              );
              return ts.factory.updateObjectLiteralExpression(
                node,
                node.properties
                  .filter(
                    (p) =>
                      !ts.isPropertyAssignment(p) ||
                      !ts.isStringLiteral(p.name) ||
                      p.name.text !== "params",
                  )
                  .concat([newParams]),
              );
            }
          }
        }
      }
    }

    return ts.visitEachChild(node, nodeVisitor, context);
  };
  const visitor: ts.Visitor = (node: ts.Node): ts.VisitResult<ts.Node> => {
    if (
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      node.name.text === "node"
    ) {
      return ts.visitEachChild(node, nodeVisitor, context);
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
    if (
      definition.kind === Kind.OPERATION_DEFINITION ||
      definition.kind === Kind.FRAGMENT_DEFINITION
    ) {
      definitions.push(transformer ? transformer(definition) : definition);
    }
  }

  return definitions;
}

function createDocument(
  definitions: Array<unknown>,
  interpolations: Array<ts.Identifier | ts.PropertyAccessExpression>,
) {
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

export function getImportArtefactTaggedTemplateTransformer(
  artefactImports: ts.ImportDeclaration[],
): TaggedTemplateTransformer {
  return (source, _context, _interpolations) => {
    const definitions = parse(source, {
      noLocation: true,
    }).definitions;

    if (definitions.length !== 1) {
      throw new Error(
        "Expected exactly one operation or fragment definition in the source string.",
      );
    }
    const definition = definitions[0];
    if (
      definition.kind !== Kind.OPERATION_DEFINITION &&
      definition.kind !== Kind.FRAGMENT_DEFINITION
    ) {
      throw new Error(
        "Expected operation or fragment definition in the source string.",
      );
    }
    const name = definition.name?.value;
    if (!name) {
      throw new Error(
        "Operation or fragment definition must have a name to be imported.",
      );
    }

    const identifier = ts.factory.createIdentifier(
      `__graphql_tag_import_${name}`,
    );

    artefactImports.push(
      ts.factory.createImportDeclaration(
        undefined,
        ts.factory.createImportClause(false, identifier, undefined),
        ts.factory.createStringLiteral(`./__generated__/${name}.graphql`),
      ),
    );

    return identifier;
  };
}
