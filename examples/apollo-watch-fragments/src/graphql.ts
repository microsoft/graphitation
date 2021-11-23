import { ApolloClient, InMemoryCache } from "@apollo/client";
import { SchemaLink } from "@apollo/client/link/schema";
import { DB } from "./db";
import { makeExecutableSchema } from "@graphql-tools/schema";

import { Resolvers } from "./graphql/resolver-typings";
import { typePolicies } from "@graphitation/apollo-react-relay-duct-tape";
const schemaSource: string = require("../data/schema.graphql");

interface Context {
  db: DB;
}

const resolvers: Resolvers<Context> = {
  Query: {
    node: (_source, { id }, context) => {
      const [typename, typeId] = id.split(":");
      switch (typename) {
        case "Todo": {
          const todo = context.db.getTodo(parseInt(typeId, 10));
          return todo ? { __typename: "Todo", ...todo } : null;
        }
      }
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
    someOtherField: () => "hello world",
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
      possibleTypes: {
        Node: ["Todo", "TodosConnection"],
      },
      typePolicies,
    }),
  });
}
