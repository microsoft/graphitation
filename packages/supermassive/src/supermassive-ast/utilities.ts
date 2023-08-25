import {
  GraphQLType,
  GraphQLSchema,
  isListType,
  Kind,
  GraphQLArgument,
  ASTVisitor,
  GraphQLCompositeType,
  GraphQLEnumValue,
  GraphQLField,
  GraphQLInputField,
  GraphQLInputType,
  GraphQLOutputType,
  getEnterLeaveForKind,
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
  isInterfaceType,
} from "graphql";

import * as TypelessAST from "graphql/language/ast";
import { Maybe } from "graphql/jsutils/Maybe";

export function makeReadableErrorPath(
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
        const namedType: unknown = getNamedType(this.getType());
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
        this._fieldDefStack.push(fieldDef);
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
        const rootType = schema.getRootType(node.operation);
        this._typeStack.push(isObjectType(rootType) ? rootType : undefined);
        break;
      }
      case Kind.INLINE_FRAGMENT:
      case Kind.FRAGMENT_DEFINITION: {
        const typeConditionAST = node.typeCondition;
        const outputType: unknown = typeConditionAST
          ? typeFromAST(schema, typeConditionAST)
          : getNamedType(this.getType());
        this._typeStack.push(isOutputType(outputType) ? outputType : undefined);
        break;
      }
      case Kind.VARIABLE_DEFINITION: {
        const inputType: unknown = typeFromAST(schema, node.type);
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
        const listType: unknown = getNullableType(this.getInputType());
        const itemType: unknown = isListType(listType)
          ? listType.ofType
          : listType;
        // List positions never have a default value.
        this._defaultValueStack.push(undefined);
        this._inputTypeStack.push(isInputType(itemType) ? itemType : undefined);
        break;
      }
      case Kind.OBJECT_FIELD: {
        const objectType: unknown = getNamedType(this.getInputType());
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
        const enumType: unknown = getNamedType(this.getInputType());
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
  if (isObjectType(parentType) || isInterfaceType(parentType)) {
    return parentType.getFields()[fieldNode.name.value];
  }
  return undefined;
  // return schema.getField(parentType, fieldNode.name.value);
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
      const fn = getEnterLeaveForKind(visitor, node.kind).enter;
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
      const fn = getEnterLeaveForKind(visitor, node.kind).leave;
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
