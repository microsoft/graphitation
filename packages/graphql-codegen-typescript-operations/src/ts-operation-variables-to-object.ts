import { TypeScriptOperationVariablesToObject as TSOperationVariablesToObject } from "@graphql-codegen/typescript";
import {
  AvoidOptionalsConfig,
  ConvertNameFn,
  NormalizedScalarsMap,
  ParsedEnumValuesMap,
} from "@graphql-codegen/visitor-plugin-common";

const BASIC_TYPES = ["string", "number", "boolean", "any"];
export class TypeScriptOperationVariablesToObject extends TSOperationVariablesToObject {
  public isMaybeUsed = false;

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
    protected setIsMaybeUsed: () => void,
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
      this.setIsMaybeUsed();
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
}
