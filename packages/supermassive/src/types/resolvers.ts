import { isScalarType } from "graphql";
import {
  Resolver,
  UserUnionTypeResolver,
  UserInterfaceTypeResolver,
  ScalarTypeResolver,
} from "../types";

export function isInterfaceTypeResolver(
  resolver: Resolver<unknown, unknown>,
): resolver is UserInterfaceTypeResolver {
  return resolver && "__resolveType" in resolver;
}

export function isUnionTypeResolver(
  resolver: Resolver<unknown, unknown>,
): resolver is UserUnionTypeResolver {
  return resolver && "__resolveType" in resolver;
}

export function isScalarTypeResolver(
  resolver: unknown,
): resolver is ScalarTypeResolver {
  return isScalarType(resolver);
}
