import {
  GraphQLDirective,
  GraphQLEnumType,
  GraphQLInputObjectType,
  GraphQLInterfaceType,
  GraphQLNamedType,
  GraphQLObjectType,
  GraphQLScalarType,
  GraphQLSchema,
  GraphQLUnionType,
  getNamedType,
  visit,
  isScalarType,
  GraphQLArgument,
  GraphQLInputField,
  astFromValue,
  isEnumType,
  isInputObjectType,
  isInterfaceType,
  isObjectType,
  isUnionType,
  print,
  Kind,
  GraphQLCompositeType,
  locatedError,
  isCompositeType,
} from "graphql";
import * as TypelessAST from "graphql/language/ast";
import {
  TypeInfo,
  makeReadableErrorPath,
  visitWithTypeInfo,
} from "./addTypesToRequestDocument";
import { specifiedDirectives } from "../types/directives";
import { inspect } from "../jsutils/inspect";
import { specifiedScalars } from "../values";

// export function addMinimalViableSchemaToRequestDocument(
//   schema: GraphQLSchema,
//   document: TypelessAST.DocumentNode,
// ): TypelessAST.DocumentNode {}

type ExtractedTypes = Map<string, ExtractedType>;

type ExtractedType =
  | ExtractedObjectType
  | ExtractedAbstractType
  | ExtractedOtherType;

type ExtractedObjectType = {
  kind: "OBJECT";
  type: GraphQLObjectType;
  usedFields: Set<string>;
};

type ExtractedAbstractType = {
  kind: "ABSTRACT";
  type: GraphQLInterfaceType; // | GraphQLUnionType;
  usedImplementations: Set<string>;
};

type ExtractedOtherType = {
  kind: "OTHER";
  type:
    | GraphQLUnionType
    | GraphQLScalarType
    | GraphQLEnumType
    | GraphQLInputObjectType
    | GraphQLDirective;
};

export function extractMinimalViableSchemaForRequestDocument(
  schema: GraphQLSchema,
  document: TypelessAST.DocumentNode,
  options: {
    ignoredDirectives?: string[];
  } = {},
): string {
  const extractedTypes: ExtractedTypes = new Map();
  const fragments: Map<
    string,
    {
      type: GraphQLCompositeType;
      def: TypelessAST.FragmentDefinitionNode;
    }
  > = new Map();
  document.definitions.forEach((def) => {
    if (def.kind === Kind.FRAGMENT_DEFINITION) {
      const typeName = def.typeCondition.name.value;
      const type = schema.getType(typeName);
      if (!type || !isCompositeType(type)) {
        throw locatedError(
          `Cannot find type ${typeName} for fragment ${def.name.value}.`,
          [def],
        );
      } else {
        fragments.set(def.name.value, {
          type,
          def,
        });
      }
    }
  });
  const typeInfo = new TypeInfo(schema, {
    defaultDirectives: specifiedDirectives,
    ignoredDirectives: options.ignoredDirectives,
  });
  visit(
    document,
    visitWithTypeInfo(typeInfo, {
      // Argument: {
      //   leave(node, _key, _parent, _path, ancestors) {},
      // },
      Directive: {
        leave(node, _key, _parent, _path, ancestors) {
          const directive = typeInfo.getDirective();
          if (directive && !extractedTypes.has(directive.name)) {
            extractedTypes.set(directive.name, {
              kind: "OTHER",
              type: directive,
            });
          }

          if (!directive && !typeInfo.isInIgnoredDirective()) {
            const errorPath = makeReadableErrorPath(ancestors);

            // This happens whenever a directive is requested that hasn't been defined in schema
            throw locatedError(
              `Cannot find type for directive: ${errorPath.join(".")}.${
                node.name.value
              }`,
              [node],
            );
          }
        },
      },
      FragmentSpread: {
        leave(node) {
          const type = getNamedType(
            typeInfo.getParentType(),
          ) as GraphQLNamedType;
          const { type: fragmentType } = fragments.get(node.name.value) || {};
          if (!fragmentType) {
            throw locatedError(`Unknown fragment ${node.name.value}.`, [node]);
          } else {
            if (type instanceof GraphQLInterfaceType) {
              const extractedType: ExtractedAbstractType = (extractedTypes.get(
                type.name,
              ) as ExtractedAbstractType) || {
                kind: "ABSTRACT",
                type,
                usedImplementations: new Set(),
              };
              extractedType.usedImplementations.add(fragmentType.name);
              extractedTypes.set(extractedType.type.name, extractedType);
            } else if (type instanceof GraphQLUnionType) {
              const extractedType: ExtractedOtherType = (extractedTypes.get(
                type.name,
              ) as ExtractedOtherType) || {
                kind: "OTHER",
                type,
              };
              extractedTypes.set(extractedType.type.name, extractedType);
            }
          }
        },
      },
      InlineFragment: {
        leave(node) {
          const type = getNamedType(
            typeInfo.getParentType(),
          ) as GraphQLNamedType;
          const typeName = node.typeCondition?.name.value;
          if (!typeName) {
            return;
          }
          const fragmentType = schema.getType(typeName);
          if (!fragmentType || !isCompositeType(fragmentType)) {
            throw locatedError(
              `Cannot find type ${typeName} for inline fragment spread.`,
              [node],
            );
          } else {
            if (type instanceof GraphQLInterfaceType) {
              const extractedType: ExtractedAbstractType = (extractedTypes.get(
                type.name,
              ) as ExtractedAbstractType) || {
                kind: "ABSTRACT",
                type,
                usedImplementations: new Set(),
              };
              extractedType.usedImplementations.add(fragmentType.name);
              extractedTypes.set(extractedType.type.name, extractedType);
            } else if (type instanceof GraphQLUnionType) {
              const extractedType: ExtractedOtherType = (extractedTypes.get(
                type.name,
              ) as ExtractedOtherType) || {
                kind: "OTHER",
                type,
              };
              extractedTypes.set(extractedType.type.name, extractedType);
            }
          }
        },
      },
      Field: {
        leave(node, _key, _parent, _path, ancestors) {
          if (node.name.value === "__typename") {
            return;
          }
          const fieldDef = typeInfo.getFieldDef();
          const type = getNamedType(
            typeInfo.getParentType(),
          ) as GraphQLNamedType;
          if (fieldDef) {
            if (type instanceof GraphQLObjectType) {
              const extractedType: ExtractedObjectType = (extractedTypes.get(
                type.name,
              ) as ExtractedObjectType) || {
                kind: "OBJECT",
                type,
                usedFields: new Set(),
              };
              extractedType.usedFields.add(fieldDef.name);
              extractedTypes.set(extractedType.type.name, extractedType);
            } else if (type instanceof GraphQLInterfaceType) {
              const extractedType: ExtractedAbstractType = (extractedTypes.get(
                type.name,
              ) as ExtractedAbstractType) || {
                kind: "ABSTRACT",
                type,
                usedImplementations: new Set(),
              };
              // We add all implementations as we don't know which ones we need
              for (const implementation of schema.getImplementations(type)
                .objects) {
                extractedType.usedImplementations.add(implementation.name);
                const extractedImplementation = (extractedTypes.get(
                  implementation.name,
                ) as ExtractedObjectType) || {
                  kind: "OBJECT",
                  type: implementation,
                  usedFields: new Set(),
                };
                extractedImplementation.usedFields.add(fieldDef.name);
                extractedTypes.set(
                  implementation.name,
                  extractedImplementation,
                );
              }
              extractedTypes.set(extractedType.type.name, extractedType);
            } else {
              const extractedType: ExtractedOtherType = (extractedTypes.get(
                type.name,
              ) as ExtractedOtherType) || {
                kind: "OTHER",
                type,
              };
              extractedTypes.set(extractedType.type.name, extractedType);
            }
            for (const arg of fieldDef.args) {
              const argType = getNamedType(arg.type);
              if (!extractedTypes.has(argType.name)) {
                extractedTypes.set(argType.name, {
                  kind: "OTHER",
                  type: argType,
                });
              }
            }
          } else {
            const errorPath = makeReadableErrorPath(ancestors);

            // This happens whenever a new field is requested that hasn't been defined in schema
            throw locatedError(
              `Cannot find type for field: ${errorPath.join(".")}.${
                node.name.value
              }`,
              [node],
            );
          }
        },
      },
    }),
  );

  const result: string[] = [];

  for (const type of extractedTypes.values()) {
    if (type.kind === "OBJECT") {
      result.push(
        printType(createFilteredObjectType(type.type, type.usedFields)),
      );
    } else if (
      type.kind === "ABSTRACT" &&
      type.type instanceof GraphQLInterfaceType
    ) {
      result.push(printType(type.type));
    } else if (type.type instanceof GraphQLDirective) {
      if (!specifiedDirectives.includes(type.type)) {
        result.push(printDirective(type.type));
      }
    } else if (type.type instanceof GraphQLScalarType) {
      if (!specifiedScalars[type.type.name]) {
        result.push(printType(type.type));
      }
    } else {
      result.push(printType(type.type));
    }
  }

  return result.join("\n");
}

function createFilteredObjectType(
  type: GraphQLObjectType,
  usedFields: Set<string>,
): GraphQLObjectType {
  const config = type.toConfig();
  return new GraphQLObjectType({
    ...config,
    fields: pick(config.fields, usedFields),
  });
}

function pick<T extends object, U extends keyof T>(
  object: T,
  keys: Set<keyof T>,
): Pick<T, U> {
  const result: Partial<T> = {};
  keys.forEach((key) => {
    result[key] = object[key];
  });
  return result as Pick<T, U>;
}

export function printType(type: GraphQLNamedType): string {
  if (isScalarType(type)) {
    return printScalar(type);
  }
  if (isObjectType(type)) {
    return printObject(type);
  }
  if (isInterfaceType(type)) {
    return printInterface(type);
  }
  if (isUnionType(type)) {
    return printUnion(type);
  }
  if (isEnumType(type)) {
    return printEnum(type);
  }
  if (isInputObjectType(type)) {
    return printInputObject(type);
  }
  /* c8 ignore next 3 */
  // Not reachable, all possible types have been considered.
  throw new Error("Unexpected type: " + inspect(type));
}

function printScalar(type: GraphQLScalarType): string {
  return `scalar ${type.name}`;
}

function printImplementedInterfaces(
  type: GraphQLObjectType | GraphQLInterfaceType,
): string {
  const interfaces = type.getInterfaces();
  return interfaces.length
    ? " implements " + interfaces.map((i) => i.name).join(" & ")
    : "";
}

function printObject(type: GraphQLObjectType): string {
  return (
    `type ${type.name}` + printImplementedInterfaces(type) + printFields(type)
  );
}

function printInterface(type: GraphQLInterfaceType): string {
  return (
    `interface ${type.name}` +
    printImplementedInterfaces(type) +
    printFields(type)
  );
}

function printUnion(type: GraphQLUnionType): string {
  const types = type.getTypes();
  const possibleTypes = types.length ? " = " + types.join(" | ") : "";
  return "union " + type.name + possibleTypes;
}

function printEnum(type: GraphQLEnumType): string {
  const values = type.getValues().map((value) => "  " + value.name);

  return `enum ${type.name}` + printBlock(values);
}

function printInputObject(type: GraphQLInputObjectType): string {
  const fields = Object.values(type.getFields()).map(
    (f) => "  " + printInputValue(f),
  );
  return `input ${type.name}` + printBlock(fields);
}

function printFields(type: GraphQLObjectType | GraphQLInterfaceType): string {
  const fields = Object.values(type.getFields()).map(
    (f) => "  " + f.name + printArgs(f.args, "  ") + ": " + String(f.type),
  );
  return printBlock(fields);
}

function printBlock(items: ReadonlyArray<string>): string {
  return items.length !== 0 ? " {\n" + items.join("\n") + "\n}" : "";
}

function printArgs(
  args: ReadonlyArray<GraphQLArgument>,
  indentation = "",
): string {
  if (args.length === 0) {
    return "";
  }

  // If every arg does not have a description, print them on one line.
  if (args.every((arg) => arg.description == null)) {
    return "(" + args.map(printInputValue).join(", ") + ")";
  }

  return (
    "(\n" +
    args.map((arg) => "  " + indentation + printInputValue(arg)).join("\n") +
    "\n" +
    indentation +
    ")"
  );
}

function printInputValue(arg: GraphQLInputField): string {
  const defaultAST = astFromValue(arg.defaultValue, arg.type);
  let argDecl = arg.name + ": " + String(arg.type);
  if (defaultAST) {
    argDecl += ` = ${print(defaultAST)}`;
  }
  return argDecl;
}

export function printDirective(directive: GraphQLDirective): string {
  return (
    "directive @" +
    directive.name +
    printArgs(directive.args) +
    (directive.isRepeatable ? " repeatable" : "") +
    " on " +
    directive.locations.join(" | ")
  );
}
