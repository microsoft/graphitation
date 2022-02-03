import {
  GraphQLInputType,
  InputValueDefinitionNode,
  GraphQLArgumentExtensions,
  GraphQLFieldConfigArgumentMap,
  GraphQLArgument,
} from "graphql";

import { Resolver, UnionTypeResolver, InterfaceTypeResolver } from "./types";
import type { Maybe } from "./jsutils/Maybe";
import type { ObjMap } from "./jsutils/ObjMap";
import { toObjMap } from "./jsutils/toObjMap";
import { keyValMap } from "./jsutils/keyValMap";

export function defineArguments(
  config: GraphQLFieldConfigArgumentMap,
): ReadonlyArray<GraphQLArgument> {
  return Object.entries(config).map(([argName, argConfig]) => ({
    name: argName,
    description: argConfig.description,
    type: argConfig.type,
    defaultValue: argConfig.defaultValue,
    deprecationReason: argConfig.deprecationReason,
    extensions: argConfig.extensions && toObjMap(argConfig.extensions),
    astNode: argConfig.astNode,
  }));
}

export function argsToArgsConfig(
  args: ReadonlyArray<GraphQLArgument>,
): GraphQLFieldConfigArgumentMap {
  return keyValMap(
    args,
    (arg) => arg.name,
    (arg) => ({
      description: arg.description,
      type: arg.type,
      defaultValue: arg.defaultValue,
      deprecationReason: arg.deprecationReason,
      extensions: arg.extensions,
      astNode: arg.astNode,
    }),
  );
}

export function isInterfaceResolverType(
  resolver: Resolver<any, any>,
): resolver is InterfaceTypeResolver {
  return "__implementedBy" in resolver && "__resolveType" in resolver;
}

export function isUnionResolverType(
  resolver: Resolver<any, any>,
): resolver is UnionTypeResolver {
  return "__types" in resolver && "__resolveType" in resolver;
}
