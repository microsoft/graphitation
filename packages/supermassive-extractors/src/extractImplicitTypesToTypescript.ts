import ts, { factory } from "typescript";
import {
  DocumentNode,
  EnumValueDefinitionNode,
  InputValueDefinitionNode,
  Kind,
  EnumTypeDefinitionNode,
  NamedTypeNode,
  InputObjectTypeDefinitionNode,
  TypeNode,
  ScalarTypeDefinitionNode,
  ValueNode,
  InterfaceTypeDefinitionNode,
  UnionTypeDefinitionNode,
  ObjectTypeDefinitionNode,
} from "graphql";

const SPECIFIED_SCALARS: Record<string, string> = {
  ID: "GraphQLID",
  String: "GraphQLString",
  Int: "GraphQLInt",
  Float: "GraphQLFloat",
  Boolean: "GraphQLBoolean",
};

const SUPERMASSIVE_TYPES = {
  INTERFACE_TYPE_RESOLVER: "InterfaceTypeResolver",
  UNION_TYPE_RESOLVER: "UnionTypeResolver",
  OBJECT_TYPE_RESOLVER: "ObjectTypeResolver",
  ENUM_TYPE_RESOLVER: "EnumTypeResolver",
  SCALAR_TYPE_RESOLVER: "ScalarTypeResolver",
  INPUT_OBJECT_TYPE_RESOLVER: "InputObjectTypeResolver",
};

export function extractImplicitTypesToTypescript(
  document: DocumentNode,
): ts.SourceFile {
  const definitions: Array<ts.VariableStatement> = [];
  const graphQLImports: Array<string> = [
    "GraphQLList",
    "GraphQLNonNull",
    "GraphQLID",
    "GraphQLString",
    "GraphQLInt",
    "GraphQLFloat",
    "GraphQLBoolean",
  ];

  const supermassiveImports: Array<string> = ["Resolvers"];

  const identifiers: Array<string> = [];
  const implementedBy: Record<string, Array<string>> = {};
  const interfaceAstNodes = [];

  for (let astNode of document.definitions) {
    if (astNode.kind === Kind.SCALAR_TYPE_DEFINITION) {
      definitions.push(createScalarType(astNode));
      addToSetArray(graphQLImports, "GraphQLScalarType");
      addToSetArray(
        supermassiveImports,
        SUPERMASSIVE_TYPES.SCALAR_TYPE_RESOLVER,
      );
      addToSetArray(identifiers, astNode.name.value);
    } else if (astNode.kind === Kind.INPUT_OBJECT_TYPE_DEFINITION) {
      definitions.push(createInputObjectType(astNode));
      addToSetArray(graphQLImports, "GraphQLInputObjectType");
      addToSetArray(
        supermassiveImports,
        SUPERMASSIVE_TYPES.INPUT_OBJECT_TYPE_RESOLVER,
      );
      addToSetArray(identifiers, astNode.name.value);
    } else if (astNode.kind === Kind.ENUM_TYPE_DEFINITION) {
      definitions.push(createEnumType(astNode));
      addToSetArray(graphQLImports, "GraphQLEnumType");
      addToSetArray(supermassiveImports, SUPERMASSIVE_TYPES.ENUM_TYPE_RESOLVER);
      addToSetArray(identifiers, astNode.name.value);
    } else if (astNode.kind === Kind.INTERFACE_TYPE_DEFINITION) {
      interfaceAstNodes.push(astNode);

      addToSetArray(
        supermassiveImports,
        SUPERMASSIVE_TYPES.INTERFACE_TYPE_RESOLVER,
      );
      addToSetArray(identifiers, astNode.name.value);
    } else if (astNode.kind === Kind.UNION_TYPE_DEFINITION) {
      const types = astNode.types?.map((typeNode) => {
        return typeNode.name.value;
      });

      definitions.push(createUnionType(astNode, types || []));

      addToSetArray(
        supermassiveImports,
        SUPERMASSIVE_TYPES.UNION_TYPE_RESOLVER,
      );
      addToSetArray(identifiers, astNode.name.value);
    } else if (astNode.kind === Kind.OBJECT_TYPE_DEFINITION) {
      astNode.interfaces?.forEach((node: NamedTypeNode) => {
        if (!implementedBy[node.name.value]) {
          implementedBy[node.name.value] = [];
        }
        implementedBy[node.name.value].push(
          (astNode as ObjectTypeDefinitionNode).name.value,
        );
      });
      definitions.push(createObjectType(astNode));
      addToSetArray(
        supermassiveImports,
        SUPERMASSIVE_TYPES.OBJECT_TYPE_RESOLVER,
      );
      addToSetArray(identifiers, astNode.name.value);
    }
  }

  interfaceAstNodes.forEach((astNode) => {
    if (!implementedBy[astNode.name.value]) {
      implementedBy[astNode.name.value] = [];
    }
    definitions.push(
      createInterfaceType(astNode, implementedBy[astNode.name.value]),
    );
  });

  const graphQLImportDefinition: ts.ImportDeclaration =
    factory.createImportDeclaration(
      undefined,
      undefined,
      factory.createImportClause(
        false,
        undefined,
        factory.createNamedImports(
          graphQLImports.map((imp) =>
            factory.createImportSpecifier(
              undefined,
              factory.createIdentifier(imp),
            ),
          ),
        ),
      ),
      factory.createStringLiteral("graphql"),
    );

  const supermassiveImportDefinition: ts.ImportDeclaration =
    factory.createImportDeclaration(
      undefined,
      undefined,
      factory.createImportClause(
        false,
        undefined,
        factory.createNamedImports(
          supermassiveImports.map((imp) =>
            factory.createImportSpecifier(
              undefined,
              factory.createIdentifier(imp),
            ),
          ),
        ),
      ),
      factory.createStringLiteral("@graphitation/supermassive"),
    );

  const exportDefinition: ts.VariableStatement =
    factory.createVariableStatement(
      [factory.createModifier(ts.SyntaxKind.ExportKeyword)],
      factory.createVariableDeclarationList(
        [
          factory.createVariableDeclaration(
            factory.createIdentifier("resolvers"),
            undefined,
            factory.createTypeReferenceNode(
              factory.createIdentifier("Resolvers"),
              undefined,
            ),
            factory.createObjectLiteralExpression(
              identifiers.map((def: string) =>
                factory.createShorthandPropertyAssignment(
                  factory.createIdentifier(def),
                  undefined,
                ),
              ),
            ),
          ),
        ],
        ts.NodeFlags.Const,
      ),
    );

  return factory.createSourceFile(
    [
      graphQLImportDefinition,
      supermassiveImportDefinition,
      ...definitions,
      exportDefinition,
    ],
    factory.createToken(ts.SyntaxKind.EndOfFileToken),
    0,
  );
}

export function extractAndPrintImplicitTypesToTypescript(
  document: DocumentNode,
): string {
  const file = extractImplicitTypesToTypescript(document);
  return ts.createPrinter().printFile(file);
}

function createDeclaration(
  name: string,
  decl: ts.Expression,
  typeReferenceNode?: ts.TypeReferenceNode,
): ts.VariableStatement {
  return factory.createVariableStatement(
    undefined,
    factory.createVariableDeclarationList(
      [
        factory.createVariableDeclaration(
          factory.createIdentifier(name),
          undefined,
          typeReferenceNode,
          decl,
        ),
      ],
      ts.NodeFlags.Const,
    ),
  );
}

function createScalarType(
  astNode: ScalarTypeDefinitionNode,
): ts.VariableStatement {
  return createDeclaration(
    astNode.name.value,
    factory.createNewExpression(
      factory.createIdentifier("GraphQLScalarType"),
      undefined,
      [
        factory.createObjectLiteralExpression(
          [
            factory.createPropertyAssignment(
              factory.createIdentifier("name"),
              factory.createStringLiteral(astNode.name.value),
            ),
            factory.createPropertyAssignment(
              factory.createIdentifier("description"),
              factory.createStringLiteral(astNode.description?.value || ""),
            ),
          ],
          true,
        ),
      ],
    ),

    factory.createTypeReferenceNode(
      factory.createIdentifier(SUPERMASSIVE_TYPES.SCALAR_TYPE_RESOLVER),
      undefined,
    ),
  );
}

function createInputObjectType(
  astNode: InputObjectTypeDefinitionNode,
): ts.VariableStatement {
  return createDeclaration(
    astNode.name.value,
    factory.createNewExpression(
      factory.createIdentifier("GraphQLInputObjectType"),
      undefined,
      [
        factory.createObjectLiteralExpression(
          [
            factory.createPropertyAssignment(
              factory.createIdentifier("name"),
              factory.createStringLiteral(astNode.name.value),
            ),
            factory.createPropertyAssignment(
              factory.createIdentifier("description"),
              factory.createStringLiteral(astNode.description?.value || ""),
            ),
            factory.createPropertyAssignment(
              factory.createIdentifier("fields"),
              factory.createArrowFunction(
                undefined,
                undefined,
                [],
                undefined,
                factory.createToken(ts.SyntaxKind.EqualsGreaterThanToken),
                factory.createParenthesizedExpression(
                  factory.createObjectLiteralExpression(
                    createInputFields(astNode.fields || []),
                    true,
                  ),
                ),
              ),
            ),
          ],
          true,
        ),
      ],
    ),
    factory.createTypeReferenceNode(
      factory.createIdentifier(SUPERMASSIVE_TYPES.INPUT_OBJECT_TYPE_RESOLVER),
      undefined,
    ),
  );
}

function createInputFields(
  astNodes: ReadonlyArray<InputValueDefinitionNode>,
): Array<ts.PropertyAssignment> {
  return astNodes.map((astNode: InputValueDefinitionNode) => {
    const fields = [
      factory.createPropertyAssignment(
        factory.createIdentifier("type"),
        createType(astNode.type),
      ),
      factory.createPropertyAssignment(
        factory.createIdentifier("description"),
        factory.createStringLiteral(astNode.description?.value || ""),
      ),
    ];
    if (astNode.defaultValue) {
      fields.push(
        factory.createPropertyAssignment(
          factory.createIdentifier("defaultValue"),
          createValue(astNode.defaultValue),
        ),
      );
    }
    return factory.createPropertyAssignment(
      factory.createIdentifier(astNode.name.value),
      factory.createObjectLiteralExpression(fields, true),
    );
  });
}

function createEnumType(astNode: EnumTypeDefinitionNode): ts.VariableStatement {
  return createDeclaration(
    astNode.name.value,
    factory.createNewExpression(
      factory.createIdentifier("GraphQLEnumType"),
      undefined,
      [
        factory.createObjectLiteralExpression([
          factory.createPropertyAssignment(
            factory.createIdentifier("name"),
            factory.createStringLiteral(astNode.name.value),
          ),
          factory.createPropertyAssignment(
            factory.createIdentifier("description"),
            factory.createStringLiteral(astNode.description?.value || ""),
          ),
          factory.createPropertyAssignment(
            factory.createIdentifier("values"),
            factory.createObjectLiteralExpression(
              (astNode.values || []).map((valueNode: EnumValueDefinitionNode) =>
                factory.createPropertyAssignment(
                  factory.createIdentifier(valueNode.name.value),
                  factory.createObjectLiteralExpression([
                    factory.createPropertyAssignment(
                      factory.createIdentifier("description"),
                      factory.createStringLiteral(
                        valueNode.description?.value || "",
                      ),
                    ),
                  ]),
                ),
              ),
            ),
          ),
        ]),
      ],
    ),
    factory.createTypeReferenceNode(
      factory.createIdentifier(SUPERMASSIVE_TYPES.ENUM_TYPE_RESOLVER),
      undefined,
    ),
  );
}

function createUnionType(
  astNode: InterfaceTypeDefinitionNode | UnionTypeDefinitionNode,
  types: string[],
): ts.VariableStatement {
  return createDeclaration(
    astNode.name.value,
    factory.createObjectLiteralExpression([
      factory.createPropertyAssignment(
        factory.createIdentifier("__types"),
        factory.createArrayLiteralExpression(
          types.map((value: string) => factory.createStringLiteral(value)),
        ),
      ),

      factory.createPropertyAssignment(
        factory.createIdentifier("__resolveType"),
        factory.createIdentifier("undefined"),
      ),
    ]),
    factory.createTypeReferenceNode(
      factory.createIdentifier(SUPERMASSIVE_TYPES.UNION_TYPE_RESOLVER),
      undefined,
    ),
  );
}

function createInterfaceType(
  astNode: InterfaceTypeDefinitionNode | UnionTypeDefinitionNode,
  implementedBy: string[],
): ts.VariableStatement {
  return createDeclaration(
    astNode.name.value,
    factory.createObjectLiteralExpression([
      factory.createPropertyAssignment(
        factory.createIdentifier("__implementedBy"),
        factory.createArrayLiteralExpression(
          implementedBy.map((value: string) =>
            factory.createStringLiteral(value),
          ),
        ),
      ),

      factory.createPropertyAssignment(
        factory.createIdentifier("__resolveType"),
        factory.createIdentifier("undefined"),
      ),
    ]),
    factory.createTypeReferenceNode(
      factory.createIdentifier(SUPERMASSIVE_TYPES.INTERFACE_TYPE_RESOLVER),
      undefined,
    ),
  );
}

function createObjectType(
  astNode: ObjectTypeDefinitionNode,
): ts.VariableStatement {
  return createDeclaration(
    astNode.name.value,
    factory.createObjectLiteralExpression(),
    factory.createTypeReferenceNode(
      factory.createIdentifier(SUPERMASSIVE_TYPES.OBJECT_TYPE_RESOLVER),
      undefined,
    ),
  );
}

function createType(astNode: TypeNode): ts.Expression {
  if (astNode.kind === Kind.LIST_TYPE) {
    return factory.createNewExpression(
      factory.createIdentifier("GraphQLList"),
      undefined,
      [createType(astNode.type)],
    );
  } else if (astNode.kind === Kind.NON_NULL_TYPE) {
    return factory.createNewExpression(
      factory.createIdentifier("GraphQLNonNull"),
      undefined,
      [createType(astNode.type)],
    );
  } else {
    if (SPECIFIED_SCALARS[astNode.name.value]) {
      return factory.createIdentifier(SPECIFIED_SCALARS[astNode.name.value]);
    } else {
      return factory.createIdentifier(astNode.name.value);
    }
  }
}

function createValue(astNode: ValueNode): ts.Expression {
  if (astNode.kind === Kind.INT || astNode.kind === Kind.FLOAT) {
    return factory.createNumericLiteral(astNode.value);
  } else if (astNode.kind === Kind.BOOLEAN) {
    return astNode.value ? factory.createTrue() : factory.createFalse();
  } else if (astNode.kind === Kind.STRING || astNode.kind === Kind.ENUM) {
    return factory.createStringLiteral(astNode.value);
  } else if (astNode.kind === Kind.NULL) {
    return factory.createNull();
  } else if (astNode.kind === Kind.LIST) {
    return factory.createArrayLiteralExpression(
      astNode.values.map((valueNode) => createValue(valueNode)),
    );
  } else if (astNode.kind === Kind.OBJECT) {
    return factory.createObjectLiteralExpression(
      astNode.fields.map((fieldNode) =>
        factory.createPropertyAssignment(
          fieldNode.name.value,
          createValue(fieldNode.value),
        ),
      ),
    );
  } else {
    throw new Error("Invalid value");
  }
}

function addToSetArray<I>(array: Array<I>, item: I): void {
  if (array.indexOf(item) === -1) {
    array.push(item);
  }
}
