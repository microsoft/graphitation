import ts, { factory } from "typescript";
import {
  DocumentNode,
  isTypeDefinitionNode,
  isTypeExtensionNode,
} from "graphql";
import { ASTReducer, visit } from "./typedVisitor";
import { TsCodegenContext } from "./context";
import { createNullableType, createNonNullableType } from "./utilities";

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

  NamedType: ts.TypeNode;
  ListType: ts.TypeNode;
  NonNullType: ts.TypeNode;

  Directive: null;

  FieldDefinition: ts.PropertySignature;

  ObjectTypeDefinition: ts.InterfaceDeclaration;
  InputObjectTypeDefinition: ts.InterfaceDeclaration;
  UnionTypeDefinition: ts.TypeAliasDeclaration;
  EnumTypeDefinition: ts.EnumDeclaration;
  EnumValueDefinition: ts.EnumMember;
  InterfaceTypeDefinition: ts.InterfaceDeclaration;
  // ScalarTypeDefinition: ts.TypeAliasDeclaration;

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
  InputObjectTypeDefinition: {
    name: ASTReducerMap["NameNode"];
    fields: ASTReducerMap["FieldDefinition"];
  };
  UnionTypeDefinition: {
    name: ASTReducerMap["NameNode"];
    types: ts.TypeNode[];
  };
  InterfaceTypeDefinition: {
    name: ASTReducerMap["NameNode"];
  };
  EnumTypeDefinition: {
    name: ASTReducerMap["NameNode"];
    values: ASTReducerMap["EnumValueDefinition"];
  };
  EnumValueDefinition: {
    name: ASTReducerMap["NameNode"];
  };
  // ScalarTypeDefinition: {
  //   name: ASTReducerMap["NameNode"];
  // };
};

function createModelsReducer(
  context: TsCodegenContext,
): ASTReducer<ts.Node | string, ASTReducerMap, ASTReducerFieldMap> {
  return {
    Document: {
      leave(node) {
        const imports = context.getAllModelImportDeclarations() as ts.Statement[];
        const statements = node.definitions;
        return factory.createSourceFile(
          imports.concat(statements.flat()),
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
          undefined,
          factory.createIdentifier(node.name),
          undefined,
          node.type,
        );
      },
    },

    ObjectTypeDefinition: {
      leave(node): ts.InterfaceDeclaration {
        const model = context.getDefinedModelType(node.name);
        const interfaces = node.interfaces || [];
        const extendTypes = [context.getBaseModelType()];
        if (model) {
          extendTypes.push(model);
        }
        console.log(extendTypes);
        return factory.createInterfaceDeclaration(
          undefined,
          [factory.createModifier(ts.SyntaxKind.ExportKeyword)],
          factory.createIdentifier(`${node.name}Model`),
          undefined,
          [
            factory.createHeritageClause(
              ts.SyntaxKind.ExtendsKeyword,
              extendTypes.map((type) =>
                factory.createExpressionWithTypeArguments(
                  type.toExpression(),
                  undefined,
                ),
              ),
              // .concat(interfaces),
            ),
          ],
          [
            factory.createPropertySignature(
              undefined,
              "__typeName",
              undefined,
              factory.createLiteralTypeNode(
                factory.createStringLiteral(node.name),
              ),
            ),
            ...(node.fields || []),
          ],
        );
      },
    },

    EnumTypeDefinition: {
      leave(node): ts.EnumDeclaration {
        return factory.createEnumDeclaration(
          undefined,
          [factory.createModifier(ts.SyntaxKind.ExportKeyword)],
          `${node.name}Model`,
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
        return factory.createInterfaceDeclaration(
          undefined,
          [factory.createModifier(ts.SyntaxKind.ExportKeyword)],
          factory.createIdentifier(`${node.name}Model`),
          undefined,
          [
            factory.createHeritageClause(
              ts.SyntaxKind.ExtendsKeyword,
              extendTypes.map((type) =>
                factory.createExpressionWithTypeArguments(
                  type.toExpression(),
                  undefined,
                ),
              ),
            ),
          ],
          [
            factory.createPropertySignature(
              undefined,
              "__typeName",
              undefined,
              factory.createTypeReferenceNode("string"),
            ),
          ],
        );
      },
    },

    NamedType: {
      leave(node): ts.TypeNode {
        return createNullableType(
          context.getModelType(node.name).toTypeReference(),
        );
      },
    },
    ListType: {
      leave({ type }): ts.TypeNode {
        return createNullableType(
          factory.createArrayTypeNode(type as ts.TypeNode),
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

    Directive: {
      leave() {
        return null;
      },
    },
  };
}
