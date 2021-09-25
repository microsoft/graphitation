import { ApolloClient, InMemoryCache } from "@apollo/client";
import { SchemaLink } from "@apollo/client/link/schema";
import { DB } from "./db";
import { makeExecutableSchema } from "@graphql-tools/schema";

import { Resolvers } from "./graphql/resolver-typings";
const schemaSource: string = require("../data/schema.graphql");

interface Context {
  db: DB;
}

const resolvers: Resolvers<Context> = {
  Query: {
    todos: () => ({}),
  },
  Mutation: {
    addTodo: (_source, args, context, _info) => {
      const todo = context.db.addTodo(args.input);
      return {
        todoEdge: {
          node: todo,
        },
      };
    },
    changeTodoStatus: (_source, { input }, context, _info) => {
      const todo = context.db.setTodoStatus(
        parseInt(input.id.split(":")[1], 10),
        input.isCompleted
      );
      return { todo };
    },
  },
  Todo: {
    id: (todo) => `Todo:${todo.id}`,
  },
  TodosConnection: {
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
    cache: new InMemoryCache(),
  });
}
