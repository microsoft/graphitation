import { BasicResolvers, Resolver } from "../types";

export function mergeResolvers(
  resolvers: BasicResolvers<any, any>,
  extractedResolvers: Record<string, Resolver<any, any>>,
) {
  const fullResolvers = {
    ...extractedResolvers,
  } as Record<string, Resolver<any, any>>;

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
