import { TypeScriptOperationVariablesToObject as TSOperationVariablesToObject } from "@graphql-codegen/typescript";
import {
  AvoidOptionalsConfig,
  ConvertNameFn,
  NormalizedScalarsMap,
  ParsedEnumValuesMap,
} from "@graphql-codegen/visitor-plugin-common";
import { Kind, TypeNode } from "graphql";

const BASIC_TYPES = ["string", "number", "boolean", "any"];
export class TypeScriptOperationVariablesToObject extends TSOperationVariablesToObject {
  public immutableTypes: boolean;

  constructor(
    _scalars: NormalizedScalarsMap,
    _convertName: ConvertNameFn,
    _avoidOptionals: boolean | AvoidOptionalsConfig,
    _immutableTypes: boolean,
    _namespacedImportName: string | null = null,
    _enumNames: string[] = [],
    _enumPrefix = true,
    _enumValues: ParsedEnumValuesMap = {},
    _applyCoercion = false,
    protected inlineCommonTypes = false,
  ) {
    super(
      _scalars,
      _convertName,
      _avoidOptionals,
      _immutableTypes,
      _namespacedImportName,
      _enumNames,
      _enumPrefix,
      _enumValues,
      _applyCoercion,
    );

    this.immutableTypes = _immutableTypes;
  }

  protected formatTypeString(
    fieldType: string,
    _isNonNullType: boolean,
    _hasDefaultValue: boolean,
  ): string {
    return fieldType;
  }

  protected wrapMaybe(type?: string) {
    if (this.inlineCommonTypes) {
      return `Maybe${type ? `<${type}>` : ""}`;
    }

    return super.wrapMaybe(type);
  }

  protected getScalar(name: string): string {
    if (this.inlineCommonTypes && BASIC_TYPES.includes(this._scalars[name])) {
      return this._scalars[name];
    }

    return super.getScalar(name);
  }

  private _clearOptional(str: string): string {
    const rgx = new RegExp(`^${this.wrapMaybe(`(.*?)`)}$`, "i");
    const maybeWithNamespace = `${
      this._namespacedImportName ? `${this._namespacedImportName}.` : ""
    }Maybe`;
    if (str.startsWith(maybeWithNamespace) || str.startsWith("Maybe")) {
      return str.replace(rgx, "$1");
    }

    return str;
  }

  public wrapAstTypeWithModifiers(
    baseType: string,
    typeNode: TypeNode,
  ): string {
    if (typeNode.kind === Kind.NON_NULL_TYPE) {
      const type = this.wrapAstTypeWithModifiers(baseType, typeNode.type);

      return this._clearOptional(type);
    } else if (typeNode.kind === Kind.LIST_TYPE) {
      const innerType = this.wrapAstTypeWithModifiers(baseType, typeNode.type);

      return this.wrapMaybe(
        `${this.immutableTypes ? "ReadonlyArray" : "Array"}<${innerType}>`,
      );
    } else {
      return this.wrapMaybe(baseType);
    }
  }
}
