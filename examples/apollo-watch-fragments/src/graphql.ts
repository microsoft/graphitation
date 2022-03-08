import { ApolloClient, InMemoryCache } from "@apollo/client";
import { SchemaLink } from "@apollo/client/link/schema";
import { DB } from "./db";
import { makeExecutableSchema } from "@graphql-tools/schema";
import { connectionFromArray } from "graphql-relay";

import { Resolvers } from "./graphql/resolver-typings";
import { typePoliciesWithDefaultApolloClientStoreKeys } from "@graphitation/apollo-react-relay-duct-tape";
const schemaSource: string = require("../data/schema.graphql");

const TODOS_FIXTURE = `
Clean counter tops
Clean microwave inside/outside
Wipe down cabinets/hardware
Clean outside of appliances
Polish stainless steel appliances
Clean refrigerator inside
Clean range vent/filter
Clean and sanitize sinks
Sweep and wash floors
Clean windows/window treatments
Clean/polish table and chairs
Sweep/mop hard floors
Vacuum carpets/area rugs
Clean/sanitize sinks
Clean/sanitize tubs, shower, toilet
Clean mirrors and glass
Clean and polish fixtures
Dust light fixtures and bulbs
Wash floors
Change sheets
Dust furniture/shelves
Vacuum floor
Wash windows
Empty wastebaskets
Dust light fixtures
Put away clean laundry
Dust/mop baseboards
Dust all hard surfaces/shelves/blinds
Vacuum carpets/area rugs
Sweep/mop hard floors
Vacuum upholstered furniture
Polish wood
Clean windows/window treatments
Dust office surfaces/equipment
File or toss loose mail/paperwork
Clean windows/window treatments
Sweep/mop hard floors
Vacuum carpets/area rugs
Vacuum carpets/area rugs
Sweep/mop hard floors
Dust cobwebs; ceiling/baseboard
Clean windows/window treatments
Clean washer and dryer exteriors
Clean inside rim of washer
Change/clean lint traps
Dust light fixtures and bulbs
Empty wastebasket
Sweep and mop floor
Clean laundry sink and fixtures
Clean laundry counter/hamper
Empty wastebaskets
Organize/dust shelves
Sweep/mop floor
Put away tools/supplies
`;

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
    todos: async (_source, args, context, info) => {
      if (info.operation.name?.value === "TodoListPaginationQuery") {
        // Synthetically make pagination take some time, so we can show a
        // loading indicator.
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
      return connectionFromArray(context.db.getTodos(), args);
    },
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
  },
};

const schema = makeExecutableSchema({
  typeDefs: schemaSource,
  resolvers,
});

export function createClient() {
  const context: Context = {
    db: new DB(
      TODOS_FIXTURE.trim()
        .split("\n")
        .map((description) => ({
          description,
          isCompleted: Math.random() < 0.5,
        }))
    ),
  };
  return new ApolloClient({
    link: new SchemaLink({ schema, context }),
    cache: new InMemoryCache({
      possibleTypes: {
        Node: ["Todo", "TodosConnection"],
      },
      typePolicies: typePoliciesWithDefaultApolloClientStoreKeys,
    }),
  });
}
