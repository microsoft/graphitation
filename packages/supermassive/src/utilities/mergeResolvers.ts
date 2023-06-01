import { UserResolvers, Resolvers, Resolver } from "../types";

export function mergeResolvers<TSource, TContext>(
  resolvers: UserResolvers<TSource, TContext>,
  extractedResolvers: Resolvers<TSource, TContext>,
): Resolvers<TSource, TContext> {
  const fullResolvers = {
    ...extractedResolvers,
  } as Resolvers<TSource, TContext>;

  Object.keys(resolvers).forEach((resolverKey: string) => {
    if (
      fullResolvers[resolverKey] &&
      typeof resolvers[resolverKey] === "object" &&
      resolvers[resolverKey].constructor === Object
    ) {
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
