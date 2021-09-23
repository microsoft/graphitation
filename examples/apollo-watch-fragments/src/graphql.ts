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

const Todo = new GraphQLObjectType({
  name: "Todo",
  fields: {
    id: {
      type: new GraphQLNonNull(GraphQLID),
    },
    description: {
      type: new GraphQLNonNull(GraphQLString),
    },
    isCompleted: {
      type: new GraphQLNonNull(GraphQLBoolean),
    },
  },
});

const TodosConnection = new GraphQLObjectType({
  name: "TodosConnection",
  fields: {
    totalCount: {
      type: new GraphQLNonNull(GraphQLInt),
    },
    uncompletedCount: {
      type: new GraphQLNonNull(GraphQLInt),
    },
    edges: {
      type: new GraphQLNonNull(
        new GraphQLList(
          new GraphQLNonNull(
            new GraphQLObjectType({
              name: "TodosConnectionEdge",
              fields: {
                node: {
                  type: new GraphQLNonNull(Todo),
                },
              },
            })
          )
        )
      ),
    },
  },
});

export const schema = new GraphQLSchema({
  query: new GraphQLObjectType({
    name: "Query",
    fields: {
      todos: {
        type: new GraphQLNonNull(TodosConnection),
      },
    },
  }),
});

export const client = new ApolloClient({
  link: new SchemaLink({
    schema,
    rootValue: {
      todos: {
        totalCount: 2,
        uncompletedCount: 1,
        edges: [
          {
            node: {
              id: "Todo:1",
              description: "Go bananas",
              isCompleted: false,
            },
          },
          {
            node: {
              id: "Todo:2",
              description: "Have coffee",
              isCompleted: true,
            },
          },
        ],
      },
    },
  }),
  cache: new InMemoryCache(),
});
