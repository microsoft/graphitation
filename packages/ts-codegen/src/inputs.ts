import ts, { factory } from "typescript";
import { InputObjectType, TsCodegenContext, Type } from "./context";

export function generateInputs(context: TsCodegenContext): ts.SourceFile {
  const statements: ts.Statement[] = [];

  const typeStatements = context
    .getAllTypes()
    .map((type) => createResolversForType(context, type))
    .filter((t) => t != null) as ts.Statement[];

  statements.push(...context.getAllImportDeclarations("INPUTS"));

  if (context.hasUsedModelInInputs) {
    statements.push(
      factory.createImportDeclaration(
        undefined,
        factory.createImportClause(
          false,
          undefined,
          factory.createNamespaceImport(factory.createIdentifier("Models")),
        ),
        factory.createStringLiteral("./models.interface"),
      ),
    );
  }

  const source = factory.createSourceFile(
    statements.concat(typeStatements),
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
