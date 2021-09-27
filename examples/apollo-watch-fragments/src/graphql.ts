import { ApolloClient, InMemoryCache } from "@apollo/client";
import { SchemaLink } from "@apollo/client/link/schema";
import { DB } from "./db";
import { makeExecutableSchema } from "@graphql-tools/schema";

import { Resolvers } from "./graphql/resolver-typings";
import { FragmentDefinitionNode, FragmentSpreadNode } from "graphql";
import invariant from "invariant";
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
              read: (existing, options) => {
                // TODO: Does the result get written to the store? If so, return `existing` immediately if it's defined.

                const nodeId = options.args!.id;
                invariant(nodeId, "Expected a node id");

                const fragmentNames = (options.field!.selectionSet!.selections.filter(
                  (sel) => sel.kind === "FragmentSpread"
                ) as FragmentSpreadNode[]).map(
                  (fragmentSpreadNode) => fragmentSpreadNode.name.value
                );
                invariant(
                  fragmentNames.length === 1,
                  "Expected a single fragment spread in the watch node query"
                );

                const fragment = options.query.definitions.find(
                  (defNode) =>
                    defNode.kind === "FragmentDefinition" &&
                    defNode.name.value === fragmentNames[0]
                ) as FragmentDefinitionNode;
                invariant(fragment, "Expected to find a fragment");

                const id = `${fragment.typeCondition.name.value}:${nodeId}`;
                const data =
                  // TODO: Check if we can just pass all fragments at once?
                  options.cache.readFragment({
                    id,
                    fragment: { kind: "Document", definitions: [fragment] },
                  });
                invariant(data, "Expected to find cached data");

                // TODO: Work with multiple fragments

                return data;
              },
            },
          },
        },
      },
    }),
  });
}
