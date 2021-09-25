import {
  GraphQLBoolean,
  GraphQLID,
  GraphQLList,
  GraphQLNonNull,
  GraphQLObjectType,
  GraphQLSchema,
  GraphQLString,
} from "graphql";
import { ApolloClient, InMemoryCache } from "@apollo/client";
import { SchemaLink } from "@apollo/client/link/schema";
import { GraphQLInt } from "graphql";
import { GraphQLInputObjectType } from "graphql";
import { DB, TodoData } from "./db";

interface Context {
  db: DB;
}

const Todo = new GraphQLObjectType<TodoData, Context>({
  name: "Todo",
  fields: {
    id: {
      type: new GraphQLNonNull(GraphQLID),
      resolve: (todo: TodoData) => `Todo:${todo.id}`,
    },
    description: {
      type: new GraphQLNonNull(GraphQLString),
    },
    isCompleted: {
      type: new GraphQLNonNull(GraphQLBoolean),
    },
  },
});

const TodosConnectionEdge = new GraphQLObjectType({
  name: "TodosConnectionEdge",
  fields: {
    node: {
      type: new GraphQLNonNull(Todo),
    },
  },
});

const TodosConnection = new GraphQLObjectType<{}, Context>({
  name: "TodosConnection",
  fields: {
    totalCount: {
      type: new GraphQLNonNull(GraphQLInt),
      resolve: (_source, _args, context) => context.db.getTotalTodoCount(),
    },
    uncompletedCount: {
      type: new GraphQLNonNull(GraphQLInt),
      resolve: (_source, _args, context) =>
        context.db.getUncompletedTodoCount(),
    },
    edges: {
      type: new GraphQLNonNull(
        new GraphQLList(new GraphQLNonNull(TodosConnectionEdge))
      ),
      resolve: (_source, _args, context) =>
        context.db.getTodos().map((todo) => ({ node: todo })),
    },
  },
});

export const schema = new GraphQLSchema({
  query: new GraphQLObjectType({
    name: "Query",
    fields: {
      todos: {
        type: new GraphQLNonNull(TodosConnection),
        resolve: () => ({}),
      },
    },
  }),
  mutation: new GraphQLObjectType<{}, Context>({
    name: "Mutation",
    fields: {
      addTodo: {
        type: new GraphQLObjectType({
          name: "AddTodoPayload",
          fields: {
            todoEdge: {
              type: TodosConnectionEdge,
            },
          },
        }),
        args: {
          input: {
            type: new GraphQLNonNull(
              new GraphQLInputObjectType({
                name: "AddTodoInput",
                fields: {
                  description: {
                    type: new GraphQLNonNull(GraphQLString),
                  },
                },
              })
            ),
          },
        },
        resolve(_source, args, context, _info) {
          const todo = context.db.addTodo(args.input);
          return {
            todoEdge: {
              node: todo,
            },
          };
        },
      },
      changeTodoStatus: {
        type: new GraphQLObjectType({
          name: "ChangeTodoStatusPayload",
          fields: {
            todo: {
              type: new GraphQLNonNull(Todo),
            },
          },
        }),
        args: {
          input: {
            type: new GraphQLNonNull(
              new GraphQLInputObjectType({
                name: "ChangeTodoStatusInput",
                fields: {
                  id: {
                    type: new GraphQLNonNull(GraphQLID),
                  },
                  isCompleted: {
                    type: new GraphQLNonNull(GraphQLBoolean),
                  },
                },
              })
            ),
          },
        },
        resolve(_source, args, context, _info) {
          const input: { id: string; isCompleted: boolean } = args.input;
          const todo = context.db.setTodoStatus(
            parseInt(input.id.split(":")[1], 10),
            input.isCompleted
          );
          return { todo };
        },
      },
    },
  }),
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
