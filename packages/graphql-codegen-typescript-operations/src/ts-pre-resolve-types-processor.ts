import {
  getBaseType,
  removeNonNullWrapper,
} from "@graphql-codegen/plugin-helpers";
import {
  PreResolveTypesProcessor as CodegenPreResolveTypesProcessor,
  PrimitiveField,
  ProcessResult,
  SelectionSetProcessorConfig,
} from "@graphql-codegen/visitor-plugin-common";
import {
  GraphQLInterfaceType,
  GraphQLObjectType,
  isEnumType,
  isNonNullType,
} from "graphql";

interface CustomSelectionSetProcessorConfig
  extends SelectionSetProcessorConfig {
  inlineCommonTypes?: boolean;
}
export class PreResolveTypesProcessor extends CodegenPreResolveTypesProcessor {
  private inlineCommonTypes: boolean;

  constructor(config: CustomSelectionSetProcessorConfig) {
    super(config);
    this.inlineCommonTypes = config.inlineCommonTypes ?? false;
  }
  transformPrimitiveFields(
    schemaType: GraphQLObjectType | GraphQLInterfaceType,
    fields: PrimitiveField[],
  ): ProcessResult {
    if (fields.length === 0) {
      return [];
    }

    return fields.map((field) => {
      const fieldObj = schemaType.getFields()[field.fieldName];

      const baseType = getBaseType(fieldObj.type);
      let typeToUse = baseType.name;

      const useInnerType = field.isConditional && isNonNullType(fieldObj.type);
      const innerType = useInnerType
        ? removeNonNullWrapper(fieldObj.type)
        : undefined;

      if (isEnumType(baseType)) {
        typeToUse =
          (this.config.namespacedImportName && this.inlineCommonTypes
            ? `${this.config.namespacedImportName}.`
            : "") +
          this.config.convertName(baseType.name, {
            useTypesPrefix: this.config.enumPrefix,
          });
      } else if ((this.config.scalars as any)[baseType.name]) {
        typeToUse = (this.config.scalars as any)[baseType.name];
      }

      const name = this.config.formatNamedField(
        field.fieldName,
        useInnerType ? innerType : fieldObj.type,
      );
      const wrappedType = this.config.wrapTypeWithModifiers(
        typeToUse,
        useInnerType ? (innerType as any) : fieldObj.type,
      );

      return {
        name,
        type: wrappedType,
      };
    });
  }
}
