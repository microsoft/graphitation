import { Resolvers } from "../types";
import { isObjectLike } from "../jsutils/isObjectLike";

export function mergeResolvers(
  accumulator: Resolvers,
  resolvers: (Resolvers | Resolvers[])[],
): Resolvers {
  for (const entry of resolvers) {
    if (Array.isArray(entry)) {
      mergeResolvers(accumulator, entry);
    } else {
      mergeResolversObjMap(accumulator, entry);
    }
  }
  return accumulator;
}

function mergeResolversObjMap(accumulator: Resolvers, resolvers: Resolvers) {
  for (const [typeName, typeResolver] of Object.entries(resolvers)) {
    const fullTypeResolver = accumulator[typeName];
    if (typeof fullTypeResolver === "undefined" && typeResolver) {
      accumulator[typeName] = typeResolver;
      return;
    }
    if (isObjectLike(fullTypeResolver) && isObjectLike(typeResolver)) {
      Object.assign(accumulator[typeName], typeResolver);
      return;
    }
  }
}
