import { Resolver, UnionTypeResolver, InterfaceTypeResolver } from "../types";
import { TypeNode } from "../supermassive-ast";

export function isInterfaceResolverType(
  resolver: Resolver<unknown, unknown>,
): resolver is InterfaceTypeResolver {
  return "__implementedBy" in resolver && "__resolveType" in resolver;
}

export function isUnionResolverType(
  resolver: Resolver<unknown, unknown>,
): resolver is UnionTypeResolver {
  return "__types" in resolver && "__resolveType" in resolver;
}
