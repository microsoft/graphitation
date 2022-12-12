import ts, { factory } from "typescript";
import { DocumentNode, Kind } from "graphql";
import { ASTReducer, visit } from "./typedVisitor";
import { TsCodegenContext } from "./context";
import {
  createNullableType,
  createNonNullableType,
  addModelSuffix,
  getAncestorEntity,
} from "./utilities";

export function generateModels(
  context: TsCodegenContext,
  document: DocumentNode,
): ts.SourceFile {
  return visit(document, createModelsReducer(context)) as ts.SourceFile;
}

type ASTReducerMap = {
  Document: ts.SourceFile;
  SchemaExtension: null;
  ObjectTypeExtension: null;

  NameNode: string;

  NamedType: ts.TypeNode | ts.Expression;
  ListType: ts.TypeNode;
  NonNullType: ts.TypeNode;

  Directive: null;

  FieldDefinition: ts.PropertySignature;
  InputValueDefinition: null;

  ObjectTypeDefinition: ts.InterfaceDeclaration | null;
  InputObjectTypeDefinition: null;
  UnionTypeDefinition: ts.TypeAliasDeclaration;
  EnumTypeDefinition: ts.EnumDeclaration;
  EnumValueDefinition: ts.EnumMember;
  InterfaceTypeDefinition: ts.InterfaceDeclaration;
  ScalarTypeDefinition: ts.TypeAliasDeclaration | null;

  DirectiveDefinition: null;
};

type ASTReducerFieldMap = {
  Document: {
    definitions: ts.Statement | ts.Statement[];
  };

  NamedType: {
    name: ASTReducerMap["NameNode"];
  };
  ListType: {
    type: ts.TypeNode;
  };
  NonNullType: {
    type: ts.TypeNode;
  };

  FieldDefinition: {
    name: ASTReducerMap["NameNode"];
    type: ts.TypeNode;
  };

  ObjectTypeDefinition: {
    name: ASTReducerMap["NameNode"];
    interfaces: ASTReducerMap["NamedType"];
    fields: ASTReducerMap["FieldDefinition"];
  };

  UnionTypeDefinition: {
    name: ASTReducerMap["NameNode"];
    types: ts.TypeNode;
  };
  InterfaceTypeDefinition: {
    name: ASTReducerMap["NameNode"];
    interfaces: ASTReducerMap["NamedType"];
  };
  EnumTypeDefinition: {
    name: ASTReducerMap["NameNode"];
    values: ASTReducerMap["EnumValueDefinition"];
  };
  EnumValueDefinition: {
    name: ASTReducerMap["NameNode"];
  };
  ScalarTypeDefinition: {
    name: null;
  };
};

function createModelsReducer(
  context: TsCodegenContext,
): ASTReducer<ts.Node | string, ASTReducerMap, ASTReducerFieldMap> {
  context.clearEntitiesToImport();
  return {
    Document: {
      leave(node) {
        const imports = context.getAllModelImportDeclarations() as ts.Statement[];
        const statements = node.definitions;

        return factory.createSourceFile(
          imports.concat(context.getDefaultTypes(), statements.flat()),
          factory.createToken(ts.SyntaxKind.EndOfFileToken),
          ts.NodeFlags.None,
        );
      },
    },
    SchemaExtension: {
      leave(): null {
        return null;
      },
    },
    ObjectTypeExtension: {
      leave(): null {
        return null;
      },
    },

    FieldDefinition: {
      leave(node): ts.PropertySignature {
        return factory.createPropertySignature(
          [factory.createModifier(ts.SyntaxKind.ReadonlyKeyword)],
          factory.createIdentifier(node.name),
          undefined,
          node.type,
        );
      },
    },

    ObjectTypeDefinition: {
      leave(node): ts.InterfaceDeclaration | null {
        const model = context.getDefinedModelType(node.name);
        const interfaces = (node.interfaces as ts.Expression[]) || [];
        const extendTypes = [context.getBaseModelType()];
        if (model) {
          extendTypes.push(model);
        }

        if (["Query", "Mutation", "Subscription"].includes(node.name)) {
          return null;
        }

        return factory.createInterfaceDeclaration(
          undefined,
          [factory.createModifier(ts.SyntaxKind.ExportKeyword)],
          factory.createIdentifier(addModelSuffix(node.name)),
          undefined,
          [
            factory.createHeritageClause(ts.SyntaxKind.ExtendsKeyword, [
              ...extendTypes.map((type) =>
                factory.createExpressionWithTypeArguments(
                  type.toExpression(),
                  undefined,
                ),
              ),
              ...interfaces.map((interfaceExpression) =>
                factory.createExpressionWithTypeArguments(
                  interfaceExpression,
                  undefined,
                ),
              ),
            ]),
          ],
          [
            factory.createPropertySignature(
              [factory.createModifier(ts.SyntaxKind.ReadonlyKeyword)],
              "__typename",
              undefined,
              factory.createLiteralTypeNode(
                factory.createStringLiteral(node.name),
              ),
            ),
            ...((!model && node.fields) || []),
          ],
        );
      },
    },
    InputObjectTypeDefinition: {
      leave(node) {
        return null;
      },
    },
    InputValueDefinition: {
      leave(node) {
        return null;
      },
    },
    EnumTypeDefinition: {
      leave(node): ts.EnumDeclaration {
        return factory.createEnumDeclaration(
          undefined,
          [factory.createModifier(ts.SyntaxKind.ExportKeyword)],
          addModelSuffix(node.name),
          node.values || [],
        );
      },
    },

    EnumValueDefinition: {
      leave(node): ts.EnumMember {
        return factory.createEnumMember(
          node.name,
          factory.createStringLiteral(node.name),
        );
      },
    },
    InterfaceTypeDefinition: {
      leave(node): ts.InterfaceDeclaration {
        const extendTypes = [context.getBaseModelType()];
        const interfaces = (node.interfaces as ts.Expression[]) || [];

        return factory.createInterfaceDeclaration(
          undefined,
          [factory.createModifier(ts.SyntaxKind.ExportKeyword)],
          factory.createIdentifier(addModelSuffix(node.name)),
          undefined,
          [
            factory.createHeritageClause(ts.SyntaxKind.ExtendsKeyword, [
              ...extendTypes.map((type) =>
                factory.createExpressionWithTypeArguments(
                  type.toExpression(),
                  undefined,
                ),
              ),
              ...interfaces.map((interfaceExpression) =>
                factory.createExpressionWithTypeArguments(
                  interfaceExpression,
                  undefined,
                ),
              ),
            ]),
          ],
          [
            factory.createPropertySignature(
              [factory.createModifier(ts.SyntaxKind.ReadonlyKeyword)],
              "__typename",
              undefined,
              factory.createKeywordTypeNode(ts.SyntaxKind.StringKeyword),
            ),
          ],
        );
      },
    },
    UnionTypeDefinition: {
      leave({ name, types }): ts.TypeAliasDeclaration {
        return factory.createTypeAliasDeclaration(
          undefined,
          [factory.createModifier(ts.SyntaxKind.ExportKeyword)],
          factory.createIdentifier(addModelSuffix(name)),
          undefined,
          factory.createUnionTypeNode(
            types?.map((type) => {
              return createNonNullableType(type as ts.UnionTypeNode);
            }) || [],
          ),
        );
      },
    },
    ScalarTypeDefinition: {
      leave(node): ts.TypeAliasDeclaration | null {
        return context.getScalarDeclaration(node.name) || null;
      },
    },
    NamedType: {
      leave(node, _a, _p, path, ancestors): ts.TypeNode | ts.Expression {
        const isImplementedInterface = path[path.length - 2] === "interfaces";
        const isImportedEntity = context.importedEntity.has(node.name);
        const entryEntity = getAncestorEntity(
          ancestors,
          parseInt(path[1] as string, 10) as number,
        );

        const isEntryEntityReplacedByModel =
          entryEntity &&
          "directives" in entryEntity &&
          entryEntity?.directives?.some(
            (directive) => directive.name.value === "model",
          );

        if (isImplementedInterface) {
          if (isImportedEntity) {
            context.addEntityToImport(node.name);
          }
          return factory.createIdentifier(addModelSuffix(node.name));
        }

        if (
          !isImportedEntity ||
          entryEntity?.kind === Kind.INTERFACE_TYPE_DEFINITION ||
          (isEntryEntityReplacedByModel &&
            entryEntity?.kind === Kind.OBJECT_TYPE_DEFINITION)
        ) {
          return createNullableType(
            context.getModelType(node.name).toTypeReference(),
          );
        }

        context.addEntityToImport(node.name);

        return createNullableType(
          context.getModelType(node.name).toTypeReference(),
        );
      },
    },
    ListType: {
      leave({ type }): ts.TypeNode {
        return createNullableType(
          factory.createTypeReferenceNode(
            factory.createIdentifier("ReadonlyArray"),
            [type as ts.TypeNode],
          ),
        );
      },
    },
    NonNullType: {
      leave({ type }): ts.TypeNode {
        return createNonNullableType(type as ts.UnionTypeNode);
      },
    },

    Name: {
      leave(node) {
        return node.value;
      },
    },

    DirectiveDefinition: {
      leave() {
        return null;
      },
    },

    Directive: {
      leave() {
        return null;
      },
    },
  };
}
