import { UserResolvers, Resolvers, Resolver } from "../types";
import { isObjectLike } from "../jsutils/isObjectLike";

export function mergeResolvers<TSource, TContext>(
  resolvers: UserResolvers<TSource, TContext>,
  extractedResolvers: Resolvers<TSource, TContext>,
): Resolvers<TSource, TContext> {
  const fullResolvers = {
    ...extractedResolvers,
  } as Resolvers<TSource, TContext>;

  Object.keys(resolvers).forEach((resolverKey: string) => {
    if (isObjectLike(fullResolvers[resolverKey])) {
      fullResolvers[resolverKey] = {
        ...fullResolvers[resolverKey],
        ...resolvers[resolverKey],
      } as Resolver<unknown, unknown>;
    } else {
      fullResolvers[resolverKey] = resolvers[resolverKey] as Resolver<
        TSource,
        TContext
      >;
    }
  });

  return fullResolvers;
}
