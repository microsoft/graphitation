import ts, { factory } from "typescript";
import {
  DocumentNode,
  isTypeDefinitionNode,
  isTypeExtensionNode,
  Kind,
} from "graphql";
import { ASTReducer, visit } from "./typedVisitor";
import { TsCodegenContext } from "./context";
import {
  createNullableType,
  createNonNullableType,
  getResolverReturnType,
} from "./utilities";

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
  InputValueDefinition: ts.PropertySignature;
  InputObjectTypeDefinition: ts.TypeAliasDeclaration;

  UnionTypeDefinitionNode: null;
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
  InputObjectTypeDefinition: {
    name: ASTReducerMap["NameNode"];
    fields: ASTReducerMap["FieldDefinition"];
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
          ts.NodeFlags.Namespace,
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
          ts.NodeFlags.Namespace,
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
        } else if (parentObject.kind !== Kind.INTERFACE_TYPE_DEFINITION) {
          modelIdentifier = context.getModelType(parentName).toTypeReference();
        }

        const resolverParametersDefinitions = {
          parent: {
            name: "model",
            type: modelIdentifier as ts.TypeReferenceNode,
          },
          args: { name: "args", type: node.arguments || [] },
          context: {
            name: "context",
            type: context.getContextType().toTypeReference(),
          },
          resolveInfo: {
            name: "info",
            type: context.getResolveInfoType().toTypeReference(),
          },
        };

        return factory.createTypeAliasDeclaration(
          undefined,
          [factory.createModifier(ts.SyntaxKind.ExportKeyword)],
          factory.createIdentifier(node.name),
          parentName === "Subscription"
            ? [
                factory.createTypeParameterDeclaration(
                  factory.createIdentifier("A"),
                  undefined,
                  factory.createKeywordTypeNode(ts.SyntaxKind.UnknownKeyword),
                ),
              ]
            : undefined,
          getResolverReturnType(
            node.type,
            parentName,
            resolverParametersDefinitions,
          ),
        );
      },
    },

    NamedType: {
      leave(node, _a, _p, _path): ts.TypeNode {
        return createNullableType(
          context.getModelType(node.name, true).toTypeReference(),
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

    Directive: {
      leave() {
        return null;
      },
    },

    InputValueDefinition: {
      leave(node): ts.PropertySignature {
        return factory.createPropertySignature(
          undefined,
          node.name,
          undefined,
          node.type,
        );
      },
    },

    InputObjectTypeDefinition: {
      leave(node): ts.TypeAliasDeclaration {
        return factory.createTypeAliasDeclaration(
          undefined,
          [factory.createModifier(ts.SyntaxKind.ExportKeyword)],
          node.name,
          undefined,
          factory.createTypeLiteralNode(
            ((node.fields as unknown) as ts.TypeElement[]) || [],
          ),
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
