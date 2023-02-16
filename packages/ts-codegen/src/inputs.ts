import ts, { factory } from "typescript";
import { DocumentNode } from "graphql";
import { InputObjectType, TsCodegenContext, Type } from "./context";

export function generateInputs(
  context: TsCodegenContext,
  document: DocumentNode,
): ts.SourceFile {
  const statements: ts.Statement[] = [];
  statements.push(
    factory.createImportDeclaration(
      undefined,
      undefined,
      factory.createImportClause(
        false,
        undefined,
        factory.createNamespaceImport(factory.createIdentifier("Models")),
      ),
      factory.createStringLiteral("./models.interface"),
    ),
  );

  statements.push(
    ...(context
      .getAllTypes()
      .map((type) => createResolversForType(context, type))
      .filter((t) => t != null) as ts.Statement[]),
  );

  const source = factory.createSourceFile(
    statements,
    factory.createToken(ts.SyntaxKind.EndOfFileToken),
    ts.NodeFlags.None,
  );
  source.fileName = "inputs.interface.ts";
  return source;
}

function createResolversForType(
  context: TsCodegenContext,
  type: Type,
): ts.Statement | null {
  switch (type.kind) {
    case "INPUT_OBJECT": {
      return createInputObjectType(context, type);
    }
    default: {
      return null;
    }
  }
}

function createInputObjectType(
  context: TsCodegenContext,
  type: InputObjectType,
): ts.TypeAliasDeclaration {
  return factory.createTypeAliasDeclaration(
    undefined,
    [factory.createModifier(ts.SyntaxKind.ExportKeyword)],
    type.name,
    undefined,
    factory.createTypeLiteralNode(
      type.fields.map(({ name, type }) =>
        factory.createPropertySignature(
          [factory.createModifier(ts.SyntaxKind.ReadonlyKeyword)],
          factory.createIdentifier(name),
          type.kind !== "NonNullType"
            ? factory.createToken(ts.SyntaxKind.QuestionToken)
            : undefined,
          context.getTypeReferenceForInputTypeFromTypeNode(type, "INPUTS"),
        ),
      ),
    ),
  );
}
