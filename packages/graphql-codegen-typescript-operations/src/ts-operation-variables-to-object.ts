import { TypeScriptOperationVariablesToObject as TSOperationVariablesToObject } from "@graphql-codegen/typescript";

const BASIC_TYPE = ["string", "number", "boolean", "any"];
export class TypeScriptOperationVariablesToObject extends TSOperationVariablesToObject {
  protected formatTypeString(
    fieldType: string,
    _isNonNullType: boolean,
    _hasDefaultValue: boolean,
  ): string {
    return fieldType;
  }

  protected getScalar(name: string): string {
    if (BASIC_TYPE.includes(this._scalars[name])) {
      return this._scalars[name];
    }

    return super.getScalar(name);
  }
}
