import { UserResolvers, Resolvers, Resolver } from "../types";

export function mergeResolvers(
  resolvers: UserResolvers<any, any>,
  extractedResolvers: Resolvers,
) {
  const fullResolvers = {
    ...extractedResolvers,
  } as Resolvers;

  Object.keys(resolvers).forEach((resolverKey: string) => {
    if (
      fullResolvers[resolverKey] &&
      typeof resolvers[resolverKey] === "object" &&
      resolvers[resolverKey].constructor === Object
    ) {
      fullResolvers[resolverKey] = {
        ...fullResolvers[resolverKey],
        ...resolvers[resolverKey],
      } as Resolver<any, any>;
    } else {
      fullResolvers[resolverKey] = resolvers[resolverKey] as Resolver<any, any>;
    }
  });

  return fullResolvers;
}
