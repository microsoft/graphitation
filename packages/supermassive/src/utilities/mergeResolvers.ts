import { UserResolvers, Resolvers, Resolver } from "../types";
import { isObjectLike } from "../jsutils/isObjectLike";

export function mergeResolvers(
  resolvers: UserResolvers<unknown, unknown>,
  extractedResolvers: Resolvers,
): Resolvers {
  const fullResolvers = {
    ...extractedResolvers,
  } as Resolvers;

  Object.keys(resolvers).forEach((resolverKey: string) => {
    if (isObjectLike(fullResolvers[resolverKey])) {
      fullResolvers[resolverKey] = {
        ...fullResolvers[resolverKey],
        ...resolvers[resolverKey],
      } as Resolver<unknown, unknown>;
    } else {
      fullResolvers[resolverKey] = resolvers[resolverKey] as Resolver<
        unknown,
        unknown
      >;
    }
  });

  return fullResolvers;
}
