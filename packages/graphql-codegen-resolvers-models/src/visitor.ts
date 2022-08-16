import { ResolversModelsPluginConfig } from "./config";
import { GraphQLSchema } from "graphql";
import { ApolloFederation } from "@graphql-codegen/plugin-helpers";

import autoBind from "auto-bind";
import {
  ParsedResolversConfig,
  BaseVisitor,
  getConfigValue,
  transformMappers,
  ParsedMapper,
} from "@graphql-codegen/visitor-plugin-common";

export class ResolversModelsVisitor<
  TRawConfig extends ResolversModelsPluginConfig = ResolversModelsPluginConfig,
  TPluginConfig extends ParsedResolversConfig = ParsedResolversConfig
> extends BaseVisitor<TRawConfig, TPluginConfig> {
  protected _federation: ApolloFederation;

  constructor(rawConfig: TRawConfig, private schema: GraphQLSchema) {
    super(rawConfig, {
      federation: getConfigValue(rawConfig.federation, false),
      mappers: transformMappers(
        rawConfig.mappers || {},
        rawConfig.mapperTypeSuffix,
      ),
    } as TPluginConfig);

    autoBind(this);
    this._federation = new ApolloFederation({
      enabled: this.config.federation,
      schema: this.schema,
    });
  }

  public getValidMappers() {
    const allSchemaTypes = this.schema.getTypeMap();
    const typeNames = this._federation.filterTypeNames(
      Object.keys(allSchemaTypes),
    );
    return typeNames.reduce((acc, typeName) => {
      const isMapped = this.config.mappers[typeName];
      if (isMapped) {
        acc[typeName] = this.config.mappers[typeName];
      }
      return acc;
    }, {} as { [typename: string]: ParsedMapper });
  }
}
