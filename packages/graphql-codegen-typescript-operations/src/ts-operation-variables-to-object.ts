import { TypeScriptOperationVariablesToObject as TSOperationVariablesToObject } from "@graphql-codegen/typescript";

const BASIC_SCALARS = ["ID", "Int", "Float", "String", "Boolean"];
export class TypeScriptOperationVariablesToObject extends TSOperationVariablesToObject {
  protected formatTypeString(
    fieldType: string,
    _isNonNullType: boolean,
    _hasDefaultValue: boolean,
  ): string {
    return fieldType;
  }
  protected getScalar(name: string): string {
    if (BASIC_SCALARS.includes(name)) {
      return this._scalars[name];
    }

    return super.getScalar(name);
  }
}
