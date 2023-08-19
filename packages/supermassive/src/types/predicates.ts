import {
  Resolver,
  UserUnionTypeResolver,
  UserInterfaceTypeResolver,
} from "../types";

export function isInterfaceTypeResolver(
  resolver: Resolver<unknown, unknown>,
): resolver is UserInterfaceTypeResolver {
  return "__resolveType" in resolver;
}

export function isUnionTypeResolver(
  resolver: Resolver<unknown, unknown>,
): resolver is UserUnionTypeResolver {
  return resolver && "__resolveType" in resolver;
}
