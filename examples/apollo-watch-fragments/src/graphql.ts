import { ApolloClient, InMemoryCache } from "@apollo/client";
import { SchemaLink } from "@apollo/client/link/schema";
import { DB } from "./db";
import { makeExecutableSchema } from "@graphql-tools/schema";

import { Resolvers } from "./graphql/resolver-typings";
import invariant from "invariant";
import { nodeFromCacheFieldPolicy } from "@graphitation/apollo-react-relay-duct-tape";
const schemaSource: string = require("../data/schema.graphql");

interface Context {
  db: DB;
}

const resolvers: Resolvers<Context> = {
  Query: {
    node: (_source, args, context) => {
      invariant(
        false,
        "Did not expect to actually be invoked! This should be intercepted by Apollo Client's type-policy."
      );
      return null;
    },
    todos: () => ({}),
  },
  Mutation: {
    addTodo: (_source, args, context, _info) => {
      const todo = context.db.addTodo(args.input);
      return {
        todoEdge: {
          node: todo,
        },
        todos: {},
      };
    },
    changeTodoStatus: (_source, { input }, context, _info) => {
      const todo = context.db.setTodoStatus(
        parseInt(input.id.split(":")[1], 10),
        input.isCompleted
      );
      return { todo, todos: {} };
    },
  },
  Todo: {
    id: (todo) => `Todo:${todo.id}`,
  },
  TodosConnection: {
    id: () => "TodosConnection:singleton",
    totalCount: (_source, _args, context) => context.db.getTotalTodoCount(),
    uncompletedCount: (_source, _args, context) =>
      context.db.getUncompletedTodoCount(),
    edges: (_source, _args, context) =>
      context.db.getTodos().map((todo) => ({ node: todo })),
  },
};

const schema = makeExecutableSchema({
  typeDefs: schemaSource,
  resolvers,
});

export function createClient() {
  const context: Context = {
    db: new DB([
      { description: "Go bananas", isCompleted: false },
      { description: "Have coffee", isCompleted: true },
    ]),
  };
  return new ApolloClient({
    link: new SchemaLink({ schema, context }),
    cache: new InMemoryCache({
      typePolicies: {
        Query: {
          fields: {
            node: {
              read: nodeFromCacheFieldPolicy,
            },
          },
        },
      },
    }),
  });
}
