import ts, { factory } from "typescript";
import {
  DocumentNode,
  EnumValueDefinitionNode,
  InputValueDefinitionNode,
  Kind,
  EnumTypeDefinitionNode,
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

export function extractImplicitTypesToTypescript(
  document: DocumentNode
): ts.SourceFile {
  const definitions: Array<ts.VariableStatement> = [];
  const imports: Array<string> = [
    "GraphQLList",
    "GraphQLNonNull",
    "GraphQLID",
    "GraphQLString",
    "GraphQLInt",
    "GraphQLFloat",
    "GraphQLBoolean",
  ];
  const identifiers: Array<string> = [];

  for (let astNode of document.definitions) {
    if (astNode.kind === Kind.SCALAR_TYPE_DEFINITION) {
      definitions.push(createScalarType(astNode));
      addToSetArray(imports, "GraphQLScalarType");
      addToSetArray(identifiers, astNode.name.value);
    } else if (astNode.kind === Kind.INPUT_OBJECT_TYPE_DEFINITION) {
      definitions.push(createInputObjectType(astNode));
      addToSetArray(imports, "GraphQLInputObjectType");
      addToSetArray(identifiers, astNode.name.value);
    } else if (astNode.kind === Kind.ENUM_TYPE_DEFINITION) {
      definitions.push(createEnumType(astNode));
      addToSetArray(imports, "GraphQLEnumType");
      addToSetArray(identifiers, astNode.name.value);
    } else if (
      astNode.kind === Kind.UNION_TYPE_DEFINITION ||
      astNode.kind === Kind.INTERFACE_TYPE_DEFINITION
    ) {
      definitions.push(createAbstractType(astNode));
      addToSetArray(identifiers, astNode.name.value);
    } else if (astNode.kind === Kind.OBJECT_TYPE_DEFINITION) {
      definitions.push(createObjectType(astNode));
      addToSetArray(identifiers, astNode.name.value);
    }
  }

  const importDefinition: ts.ImportDeclaration = factory.createImportDeclaration(
    undefined,
    undefined,
    factory.createImportClause(
      false,
      undefined,
      factory.createNamedImports(
        imports.map((imp) =>
          factory.createImportSpecifier(
            undefined,
            factory.createIdentifier(imp)
          )
        )
      )
    ),
    factory.createStringLiteral("graphql")
  );

  const exportDefinition: ts.VariableStatement = factory.createVariableStatement(
    [factory.createModifier(ts.SyntaxKind.ExportKeyword)],
    factory.createVariableDeclarationList(
      [
        factory.createVariableDeclaration(
          factory.createIdentifier("resolvers"),
          undefined,
          undefined,
          factory.createObjectLiteralExpression(
            identifiers.map((def: string) =>
              factory.createShorthandPropertyAssignment(
                factory.createIdentifier(def),
                undefined
              )
            )
          )
        ),
      ],
      ts.NodeFlags.Const
    )
  );

  return factory.createSourceFile(
    [importDefinition, ...definitions, exportDefinition],
    factory.createToken(ts.SyntaxKind.EndOfFileToken),
    0
  );
}

function createDeclaration(
  name: string,
  decl: ts.Expression
): ts.VariableStatement {
  return factory.createVariableStatement(
    undefined,
    factory.createVariableDeclarationList(
      [
        factory.createVariableDeclaration(
          factory.createIdentifier(name),
          undefined,
          undefined,
          decl
        ),
      ],
      ts.NodeFlags.Const
    )
  );
}

function createScalarType(
  astNode: ScalarTypeDefinitionNode
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
              factory.createStringLiteral(astNode.name.value)
            ),
            factory.createPropertyAssignment(
              factory.createIdentifier("description"),
              factory.createStringLiteral(astNode.description?.value || "")
            ),
          ],
          true
        ),
      ]
    )
  );
}

function createInputObjectType(
  astNode: InputObjectTypeDefinitionNode
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
              factory.createStringLiteral(astNode.name.value)
            ),
            factory.createPropertyAssignment(
              factory.createIdentifier("description"),
              factory.createStringLiteral(astNode.description?.value || "")
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
                    true
                  )
                )
              )
            ),
          ],
          true
        ),
      ]
    )
  );
}

function createInputFields(
  astNodes: ReadonlyArray<InputValueDefinitionNode>
): Array<ts.PropertyAssignment> {
  return astNodes.map((astNode: InputValueDefinitionNode) => {
    const fields = [
      factory.createPropertyAssignment(
        factory.createIdentifier("type"),
        createType(astNode.type)
      ),
      factory.createPropertyAssignment(
        factory.createIdentifier("description"),
        factory.createStringLiteral(astNode.description?.value || "")
      ),
    ];
    if (astNode.defaultValue) {
      fields.push(
        factory.createPropertyAssignment(
          factory.createIdentifier("defaultValue"),
          createValue(astNode.defaultValue)
        )
      );
    }
    return factory.createPropertyAssignment(
      factory.createIdentifier(astNode.name.value),
      factory.createObjectLiteralExpression(fields, true)
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
            factory.createStringLiteral(astNode.name.value)
          ),
          factory.createPropertyAssignment(
            factory.createIdentifier("description"),
            factory.createStringLiteral(astNode.description?.value || "")
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
                        valueNode.description?.value || ""
                      )
                    ),
                  ])
                )
              )
            )
          ),
        ]),
      ]
    )
  );
}

function createAbstractType(
  astNode: InterfaceTypeDefinitionNode | UnionTypeDefinitionNode
): ts.VariableStatement {
  return createDeclaration(
    astNode.name.value,
    factory.createObjectLiteralExpression([
      factory.createPropertyAssignment(
        factory.createIdentifier("__resolveType"),
        factory.createIdentifier("undefined")
      ),
    ])
  );
}

function createObjectType(
  astNode: ObjectTypeDefinitionNode
): ts.VariableStatement {
  return createDeclaration(
    astNode.name.value,
    factory.createObjectLiteralExpression()
  );
}

function createType(astNode: TypeNode): ts.Expression {
  if (astNode.kind === Kind.LIST_TYPE) {
    return factory.createNewExpression(
      factory.createIdentifier("GraphQLList"),
      undefined,
      [createType(astNode.type)]
    );
  } else if (astNode.kind === Kind.NON_NULL_TYPE) {
    return factory.createNewExpression(
      factory.createIdentifier("GraphQLNonNull"),
      undefined,
      [createType(astNode.type)]
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
      astNode.values.map((valueNode) => createValue(valueNode))
    );
  } else if (astNode.kind === Kind.OBJECT) {
    return factory.createObjectLiteralExpression(
      astNode.fields.map((fieldNode) =>
        factory.createPropertyAssignment(
          fieldNode.name.value,
          createValue(fieldNode.value)
        )
      )
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
