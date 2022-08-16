import { RawConfig } from "@graphql-codegen/visitor-plugin-common";

export type MapperConfigValue = {
  extend?: boolean;
  exclude?: string[];
};
export interface ResolversModelsPluginConfig extends RawConfig {
  mappers?: { [typeName: string]: string };
  mapperTypeSuffix?: string;
  mappersConfig?: {
    [typeName: string]: MapperConfigValue;
  };
  federation?: boolean;
  modelIntersectionSuffix?: string;
  namespacedImportName?: string;
}
