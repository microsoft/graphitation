import {
  GraphQLType,
  GraphQLSchema,
  isListType,
  isNamedType,
  isNonNullType,
  visit,
  Kind,
  astFromValue,
  GraphQLArgument,
  ASTVisitor,
  GraphQLCompositeType,
  GraphQLEnumValue,
  GraphQLField,
  GraphQLInputField,
  GraphQLInputType,
  GraphQLOutputType,
  getNamedType,
  getNullableType,
  isCompositeType,
  isEnumType,
  isInputObjectType,
  isInputType,
  isObjectType,
  isOutputType,
  typeFromAST,
  GraphQLDirective,
  GraphQLObjectType,
  GraphQLInterfaceType,
  getVisitFn,
} from "graphql";

import * as TypelessAST from "graphql/language/ast";
import * as TypedAST from "./TypedAST";
import { Maybe } from "graphql/jsutils/Maybe";
export * from "./TypedAST";
import { specifiedDirectives } from "./directives";
import { GraphQLInputObjectType } from "graphql";

export function addTypesToRequestDocument(
  schema: GraphQLSchema,
  document: TypelessAST.DocumentNode,
  options: {
    ignoredDirectives?: string[];
  } = {},
): TypedAST.DocumentNode {
  const typeInfo = new TypeInfo(schema, {
    defaultDirectives: specifiedDirectives,
    ignoredDirectives: options.ignoredDirectives,
  });
  return visit(
    document as TypelessAST.DocumentNode,
    visitWithTypeInfo(typeInfo, {
      Argument: {
        leave(node, _key, _parent, _path, ancestors) {
          const argument = typeInfo.getArgument();
          if (argument) {
            const typeNode = generateTypeNode(argument.type);
            const newNode: TypedAST.ArgumentNode = {
              ...node,
              __type: typeNode,
            };
            // We only need default value for arguments with variable values
            if (argument.defaultValue && node.value.kind === Kind.VARIABLE) {
              (newNode.__defaultValue as
                | TypedAST.ValueNode
                | null
                | undefined) = astFromValue(
                argument.defaultValue,
                argument.type,
              );
            }
            return newNode;
          }
          if (!typeInfo.isInIgnoredDirective()) {
            const errorPath = makeReadableErrorPath(ancestors);
            throw new Error(
              `Cannot find type for argument: ${errorPath.join(".")}.${
                node.name.value
              }`,
            );
          }
        },
      },
      Directive: {
        leave(
          node: TypelessAST.DirectiveNode,
          _key,
          _parent,
          _path,
          ancestors,
        ) {
          const directiveDef = typeInfo.getDirective();
          if (directiveDef) {
            const missingArgs: Array<GraphQLArgument> =
              directiveDef.args.filter(
                (argDef) =>
                  argDef.defaultValue != null &&
                  node.arguments?.findIndex(
                    (arg) => arg.name.value === argDef.name,
                  ) === -1,
              );
            if (missingArgs) {
              const newNode: TypedAST.DirectiveNode = {
                ...(node as Omit<TypelessAST.DirectiveNode, "arguments">),
              };
              (newNode.arguments as TypedAST.ArgumentNode[]) = (
                newNode.arguments || []
              ).concat(
                missingArgs.map((arg) => ({
                  __type: generateTypeNode(arg.type),
                  kind: Kind.ARGUMENT,
                  name: {
                    kind: Kind.NAME,
                    value: arg.name,
                  },
                  value: astFromValue(
                    arg.defaultValue,
                    arg.type,
                  ) as TypedAST.ValueNode,
                })),
              );
              return newNode;
            }
            return node as TypedAST.DirectiveNode;
          }

          if (!typeInfo.isInIgnoredDirective()) {
            const errorPath = makeReadableErrorPath(ancestors);

            // This happens whenever a directive is requested that hasn't been defined in schema
            throw new Error(
              `Cannot find type for directive: ${errorPath.join(".")}.${
                node.name.value
              }`,
            );
          }
        },
      },
      Field: {
        leave(
          node: Omit<TypelessAST.FieldNode, "selectionSet" | "directives">,
          _key,
          _parent,
          _path,
          ancestors,
        ) {
          const fieldDef = typeInfo.getFieldDef();
          if (fieldDef) {
            const type = fieldDef.type;
            if (type) {
              const typeNode = generateTypeNode(type);
              const missingArgs: Array<GraphQLArgument> = fieldDef.args.filter(
                (argDef) =>
                  argDef.defaultValue != null &&
                  node.arguments?.findIndex(
                    (arg) => arg.name.value === argDef.name,
                  ) === -1,
              );
              const newNode: TypedAST.FieldNode = {
                ...(node as Omit<
                  TypelessAST.FieldNode,
                  "selectionSet" | "arguments" | "directives"
                >),
                __type: typeNode,
              };
              if (missingArgs) {
                (newNode.arguments as TypedAST.ArgumentNode[]) = (
                  newNode.arguments || []
                ).concat(
                  missingArgs.map((arg) => ({
                    __type: generateTypeNode(arg.type),
                    kind: Kind.ARGUMENT,
                    name: {
                      kind: Kind.NAME,
                      value: arg.name,
                    },
                    value: astFromValue(
                      arg.defaultValue,
                      arg.type,
                    ) as TypedAST.ValueNode,
                  })),
                );
              }
              return newNode;
            }
          }

          const errorPath = makeReadableErrorPath(ancestors);

          // This happens whenever a new field is requested that hasn't been defined in schema
          throw new Error(
            `Cannot find type for field: ${errorPath.join(".")}.${
              node.name.value
            }`,
          );
        },
      },
    }),
  ) as TypedAST.DocumentNode;
}

function generateTypeNode(type: GraphQLType): TypedAST.TypeNode {
  if (isNonNullType(type)) {
    const typeNode = generateTypeNode(type.ofType) as
      | TypedAST.NamedTypeNode
      | TypedAST.ListTypeNode;
    return {
      kind: "NonNullType",
      type: typeNode,
    };
  } else if (isListType(type)) {
    const typeNode = generateTypeNode(type.ofType) as
      | TypedAST.NamedTypeNode
      | TypedAST.NonNullTypeNode;
    return {
      kind: "ListType",
      type: typeNode,
    };
  } else if (isNamedType(type)) {
    return {
      kind: "NamedType",
      name: {
        kind: "Name",
        value: type.name,
      },
    };
  }
  throw new Error(`Can't generate TypeNode for type: ${type}`);
}

function makeReadableErrorPath(
  ancestors: ReadonlyArray<
    readonly TypelessAST.ASTNode[] | TypelessAST.ASTNode
  >,
): string[] {
  const path: string[] = [];
  ancestors.forEach((ancestorOrArray) => {
    let ancestor: TypelessAST.ASTNode;
    if (!Array.isArray(ancestorOrArray)) {
      ancestor = ancestorOrArray as TypelessAST.ASTNode;
      if (ancestor && ancestor.kind === Kind.FIELD) {
        path.push(ancestor.name.value);
      } else if (ancestor && ancestor.kind === Kind.DIRECTIVE) {
        path.push(`@${ancestor.name.value}`);
      } else if (ancestor && ancestor.kind === Kind.OPERATION_DEFINITION) {
        let name;
        if (ancestor.name) {
          name = `${ancestor.operation} ${ancestor.name.value}`;
        } else {
          name = ancestor.operation;
        }
        path.push(name);
      }
    }
  });
  return path;
}

/**
 * TypeInfo is a utility class which, given a GraphQL schema, can keep track
 * of the current field and type definitions at any point in a GraphQL document
 * AST during a recursive descent by calling `enter(node)` and `leave(node)`.
 */
export class TypeInfo {
  private _schema: GraphQLSchema;
  private _typeStack: Array<Maybe<GraphQLOutputType>>;
  private _parentTypeStack: Array<Maybe<GraphQLCompositeType>>;
  private _inputTypeStack: Array<Maybe<GraphQLInputType>>;
  private _fieldDefStack: Array<Maybe<GraphQLField<unknown, unknown>>>;
  private _defaultValueStack: Array<Maybe<unknown>>;
  private _directive: Maybe<GraphQLDirective>;
  private _argument: Maybe<GraphQLArgument>;
  private _enumValue: Maybe<GraphQLEnumValue>;
  private _isInIgnoredDirective: boolean;

  private _defaultDirectives: Map<string, GraphQLDirective>;
  private _ignoredDirectives: Set<string>;

  constructor(
    schema: GraphQLSchema,
    /**
     * Initial type may be provided in rare cases to facilitate traversals
     *  beginning somewhere other than documents.
     */
    options: {
      initialType?: Maybe<GraphQLType>;
      defaultDirectives?: ReadonlyArray<GraphQLDirective>;
      ignoredDirectives?: ReadonlyArray<string>;
    } = {},
  ) {
    this._schema = schema;
    this._typeStack = [];
    this._parentTypeStack = [];
    this._inputTypeStack = [];
    this._fieldDefStack = [];
    this._defaultValueStack = [];
    this._directive = null;
    this._isInIgnoredDirective = false;
    this._argument = null;
    this._enumValue = null;
    if (options.initialType) {
      if (isInputType(options.initialType)) {
        this._inputTypeStack.push(options.initialType);
      }
      if (isCompositeType(options.initialType)) {
        this._parentTypeStack.push(options.initialType);
      }
      if (isOutputType(options.initialType)) {
        this._typeStack.push(options.initialType);
      }
    }
    this._defaultDirectives = new Map();
    for (const directive of options.defaultDirectives || []) {
      this._defaultDirectives.set(directive.name, directive);
    }
    this._ignoredDirectives = new Set(options.ignoredDirectives || []);
  }

  get [Symbol.toStringTag]() {
    return "TypeInfo";
  }

  getType(): Maybe<GraphQLOutputType> {
    return at(this._typeStack, -1);
  }

  getParentType(): Maybe<GraphQLCompositeType> {
    return at(this._parentTypeStack, -1);
  }

  getInputType(): Maybe<GraphQLInputType> {
    return at(this._inputTypeStack, -1);
  }

  getParentInputType(): Maybe<GraphQLInputType> {
    return at(this._inputTypeStack, -2);
  }

  getFieldDef(): Maybe<GraphQLField<unknown, unknown>> {
    return at(this._fieldDefStack, -1);
  }

  getDefaultValue(): Maybe<unknown> {
    return at(this._defaultValueStack, -1);
  }

  getDirective(): Maybe<GraphQLDirective> {
    return this._directive;
  }

  getArgument(): Maybe<GraphQLArgument> {
    return this._argument;
  }

  getEnumValue(): Maybe<GraphQLEnumValue> {
    return this._enumValue;
  }

  isInIgnoredDirective(): boolean {
    return this._isInIgnoredDirective;
  }

  enter(node: TypelessAST.ASTNode) {
    const schema = this._schema;
    // Note: many of the types below are explicitly typed as "unknown" to drop
    // any assumptions of a valid schema to ensure runtime types are properly
    // checked before continuing since TypeInfo is used as part of validation
    // which occurs before guarantees of schema and document validity.
    switch (node.kind) {
      case Kind.SELECTION_SET: {
        const namedType: unknown = getNamedType(this.getType() as GraphQLType);
        this._parentTypeStack.push(
          isCompositeType(namedType) ? namedType : undefined,
        );
        break;
      }
      case Kind.FIELD: {
        const parentType = this.getParentType();
        let fieldDef;
        let fieldType: unknown;
        if (parentType) {
          fieldDef = getFieldDef(schema, parentType, node);
          if (fieldDef) {
            fieldType = fieldDef.type;
          }
        }
        this._fieldDefStack.push(fieldDef as any);
        this._typeStack.push(isOutputType(fieldType) ? fieldType : undefined);
        break;
      }
      case Kind.DIRECTIVE: {
        const name = node.name.value;
        this._directive = schema.getDirective(name) as GraphQLDirective;
        if (!this._directive) {
          if (this._defaultDirectives.has(name)) {
            this._directive = this._defaultDirectives.get(name);
          }
          if (this._ignoredDirectives.has(name)) {
            this._isInIgnoredDirective = true;
          }
        }
        break;
      }
      case Kind.OPERATION_DEFINITION: {
        const rootType = schema.getType(node.operation);
        this._typeStack.push(isObjectType(rootType) ? rootType : undefined);
        break;
      }
      case Kind.INLINE_FRAGMENT:
      case Kind.FRAGMENT_DEFINITION: {
        const typeConditionAST = node.typeCondition;
        const outputType: unknown = typeConditionAST
          ? typeFromAST(schema, typeConditionAST)
          : getNamedType(this.getType() as GraphQLType);
        this._typeStack.push(isOutputType(outputType) ? outputType : undefined);
        break;
      }
      case Kind.VARIABLE_DEFINITION: {
        const inputType: unknown = typeFromAST(
          schema,
          node.type as TypelessAST.NamedTypeNode,
        );
        this._inputTypeStack.push(
          isInputType(inputType) ? inputType : undefined,
        );
        break;
      }
      case Kind.ARGUMENT: {
        let argDef;
        let argType: unknown;
        const fieldOrDirective = this.getDirective() ?? this.getFieldDef();
        if (fieldOrDirective) {
          argDef = fieldOrDirective.args.find(
            (arg) => arg.name === node.name.value,
          );
          if (argDef) {
            argType = argDef.type;
          }
        }
        this._argument = argDef;
        this._defaultValueStack.push(argDef ? argDef.defaultValue : undefined);
        this._inputTypeStack.push(isInputType(argType) ? argType : undefined);
        break;
      }
      case Kind.LIST: {
        const listType: unknown = getNullableType(
          this.getInputType() as GraphQLType,
        );
        const itemType: unknown = isListType(listType)
          ? listType.ofType
          : listType;
        // List positions never have a default value.
        this._defaultValueStack.push(undefined);
        this._inputTypeStack.push(isInputType(itemType) ? itemType : undefined);
        break;
      }
      case Kind.OBJECT_FIELD: {
        const objectType: unknown = getNamedType(
          this.getInputType() as GraphQLType,
        );
        let inputFieldType: GraphQLInputType | undefined;
        let inputField: GraphQLInputField | undefined;
        if (isInputObjectType(objectType)) {
          inputField = objectType.getFields()[node.name.value];
          if (inputField != null) {
            inputFieldType = inputField.type;
          }
        }
        this._defaultValueStack.push(
          inputField ? inputField.defaultValue : undefined,
        );
        this._inputTypeStack.push(
          isInputType(inputFieldType) ? inputFieldType : undefined,
        );
        break;
      }
      case Kind.ENUM: {
        const enumType: unknown = getNamedType(
          this.getInputType() as GraphQLType,
        );
        let enumValue;
        if (isEnumType(enumType)) {
          enumValue = enumType.getValue(node.value);
        }
        this._enumValue = enumValue;
        break;
      }
      default:
      // Ignore other nodes
    }
  }

  leave(node: TypelessAST.ASTNode) {
    switch (node.kind) {
      case Kind.SELECTION_SET:
        this._parentTypeStack.pop();
        break;
      case Kind.FIELD:
        this._fieldDefStack.pop();
        this._typeStack.pop();
        break;
      case Kind.DIRECTIVE:
        this._directive = null;
        this._isInIgnoredDirective = false;
        break;
      case Kind.OPERATION_DEFINITION:
      case Kind.INLINE_FRAGMENT:
      case Kind.FRAGMENT_DEFINITION:
        this._typeStack.pop();
        break;
      case Kind.VARIABLE_DEFINITION:
        this._inputTypeStack.pop();
        break;
      case Kind.ARGUMENT:
        this._argument = null;
        this._defaultValueStack.pop();
        this._inputTypeStack.pop();
        break;
      case Kind.LIST:
      case Kind.OBJECT_FIELD:
        this._defaultValueStack.pop();
        this._inputTypeStack.pop();
        break;
      case Kind.ENUM:
        this._enumValue = null;
        break;
      default:
      // Ignore other nodes
    }
  }
}

function getFieldDef(
  schema: GraphQLSchema,
  parentType: GraphQLCompositeType,
  fieldNode: TypelessAST.FieldNode,
) {
  if (
    parentType instanceof GraphQLObjectType ||
    parentType instanceof GraphQLInterfaceType ||
    parentType instanceof GraphQLInputObjectType
  ) {
    return parentType.getFields()[fieldNode.name.value];
  } else {
    return null;
  }
}

/**
 * Creates a new visitor instance which maintains a provided TypeInfo instance
 * along with visiting visitor.
 */
export function visitWithTypeInfo(
  typeInfo: TypeInfo,
  visitor: ASTVisitor,
): ASTVisitor {
  return {
    enter(...args) {
      const node = args[0];
      typeInfo.enter(node);
      const fn = getVisitFn(visitor, node.kind, false);
      if (fn) {
        const result = fn.apply(visitor, args);
        if (result !== undefined) {
          typeInfo.leave(node);
          if (TypelessAST.isNode(result)) {
            typeInfo.enter(result);
          }
        }
        return result;
      }
    },
    leave(...args) {
      const node = args[0];
      const fn = getVisitFn(visitor, node.kind, true);
      let result;
      if (fn) {
        result = fn.apply(visitor, args);
      }
      typeInfo.leave(node);
      return result;
    },
  };
}
function at<A>(arr: A[], index: number): A | undefined {
  const len = arr.length;
  const relativeIndex = index >= 0 ? index : len + index;

  if (relativeIndex < 0 || relativeIndex >= len) {
    return undefined;
  }

  return arr[relativeIndex];
}
