import { ApolloLink, Observable } from "@apollo/client";
import {
  executeWithoutSchema as supermassiveExecute,
  Resolvers,
} from "@graphitation/supermassive";
import { resolvers, TodoStorage } from "./resolvers";
import { resolvers as generatedResolvers } from "./__generated__/typeDefs";

export const supermassiveSchemaLink = new ApolloLink((operation) => {
  return new Observable((observer) => {
    (async () => {
      try {
        const result = await supermassiveExecute({
          document: operation?.query as any,
          resolvers: { ...generatedResolvers, ...resolvers } as any,
          contextValue: {
            todoStorage: new TodoStorage(window.localStorage),
          },
        });
        observer.next(result);
        observer.complete();
      } catch (e) {
        observer.error(e);
      }
    })();
  });
});
