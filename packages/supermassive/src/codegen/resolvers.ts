import ts, { factory } from "typescript";
import {
  DocumentNode,
  isTypeDefinitionNode,
  isTypeExtensionNode,
} from "graphql";
import { ASTReducer, visit } from "./typedVisitor";
import { TsCodegenContext } from "./context";
import { createNullableType, createNonNullableType } from "./utilities";

export function generateResolvers(
  context: TsCodegenContext,
  document: DocumentNode,
): ts.SourceFile {
  return visit(document, createResolversReducer(context)) as ts.SourceFile;
}

type ASTReducerMap = {
  Document: ts.SourceFile;
  SchemaExtension: null;
  ObjectTypeDefinition: ts.ModuleDeclaration;
  ObjectTypeExtension: ts.ModuleDeclaration;
  FieldDefinition: ts.TypeAliasDeclaration;
  NameNode: string;

  NamedType: ts.TypeNode;
  ListType: ts.TypeNode;
  NonNullType: ts.TypeNode;

  Directive: null;

  InputFieldDefinition: ts.TypeElement;

  UnionTypeDefinitionNode: null;
  InputObjectTypeDefinition: null;
  InterfaceTypeDefinitionNode: null;
  EnumTypeDefinitionNode: null;
  ScalarTypeDefinition: null;
  DirectiveDefinition: null;
};

type ASTReducerFieldMap = {
  Document: {
    definitions: ts.Statement | ts.Statement[];
  };
  ObjectTypeDefinition: {
    name: ASTReducerMap["NameNode"];
    fields: ASTReducerMap["FieldDefinition"];
  };
  ObjectTypeExtension: {
    name: ASTReducerMap["NameNode"];
    fields: ASTReducerMap["FieldDefinition"];
  };
  FieldDefinition: {
    name: ASTReducerMap["NameNode"];
    type: ts.TypeNode;
    arguments: ASTReducerMap["InputFieldDefinition"];
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

  InputValueDefinition: {
    name: ASTReducerMap["NameNode"];
    type: ts.TypeNode;
  };
};

function createResolversReducer(
  context: TsCodegenContext,
): ASTReducer<ts.Node | string, ASTReducerMap, ASTReducerFieldMap> {
  return {
    Document: {
      leave(node) {
        const imports = context.getAllResolverImportDeclarations() as ts.Statement[];
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
    ObjectTypeDefinition: {
      leave(node): ts.ModuleDeclaration {
        return factory.createModuleDeclaration(
          undefined,
          [
            factory.createModifier(ts.SyntaxKind.ExportKeyword),
            factory.createModifier(ts.SyntaxKind.DeclareKeyword),
          ],
          factory.createIdentifier(node.name),
          factory.createModuleBlock(node.fields || []),
        );
      },
    },
    ObjectTypeExtension: {
      leave(node): ts.ModuleDeclaration {
        return factory.createModuleDeclaration(
          undefined,
          [
            factory.createModifier(ts.SyntaxKind.ExportKeyword),
            factory.createModifier(ts.SyntaxKind.DeclareKeyword),
          ],
          factory.createIdentifier(node.name),
          factory.createModuleBlock(node.fields || []),
        );
      },
    },
    FieldDefinition: {
      leave(node, _a, _p, _path, ancestors): ts.TypeAliasDeclaration {
        const parentObject = ancestors[ancestors.length - 1];
        if (
          !(
            "kind" in parentObject &&
            (isTypeDefinitionNode(parentObject) ||
              isTypeExtensionNode(parentObject))
          )
        ) {
          throw new Error("Invalid parent for field");
        }
        const parentName = parentObject.name.value;
        let modelIdentifier;
        if (["Query", "Mutation", "Subscription"].includes(parentName)) {
          modelIdentifier = factory.createKeywordTypeNode(
            ts.SyntaxKind.UnknownKeyword,
          );
        } else {
          modelIdentifier = context.getModelType(parentName).toTypeReference();
        }
        return factory.createTypeAliasDeclaration(
          undefined,
          [factory.createModifier(ts.SyntaxKind.ExportKeyword)],
          factory.createIdentifier(node.name),
          undefined,
          factory.createFunctionTypeNode(
            undefined,
            [
              factory.createParameterDeclaration(
                undefined,
                undefined,
                undefined,
                factory.createIdentifier("model"),
                undefined,
                modelIdentifier,
                // factory.createKeywordTypeNode(ts.SyntaxKind.UnknownKeyword),
                undefined,
              ),
              factory.createParameterDeclaration(
                undefined,
                undefined,
                undefined,
                factory.createIdentifier("args"),
                undefined,
                factory.createTypeLiteralNode(node.arguments || []),
                undefined,
              ),
              factory.createParameterDeclaration(
                undefined,
                undefined,
                undefined,
                factory.createIdentifier("context"),
                undefined,
                context.getContextType().toTypeReference(),
                undefined,
              ),
              factory.createParameterDeclaration(
                undefined,
                undefined,
                undefined,
                factory.createIdentifier("info"),
                undefined,
                context.getResolveInfoType().toTypeReference(),
                undefined,
              ),
            ],
            factory.createTypeReferenceNode(
              factory.createIdentifier("PromiseOrValue"),
              [node.type],
            ),
          ),
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

    InputValueDefinition: {
      leave(node) {
        return factory.createPropertySignature(
          undefined,
          node.name,
          undefined,
          node.type as ts.TypeNode,
        );
      },
    },

    UnionTypeDefinition: {
      leave() {
        return null;
      },
    },

    EnumTypeDefinition: {
      leave() {
        return null;
      },
    },

    InterfaceTypeDefinition: {
      leave() {
        return null;
      },
    },

    InputObjectTypeDefinition: {
      leave() {
        return null;
      },
    },

    DirectiveDefinition: {
      leave() {
        return null;
      },
    },

    ScalarTypeDefinition: {
      leave() {
        return null;
      },
    },
  };
}
