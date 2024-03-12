import {
  ApolloClient,
  InMemoryCache,
  defaultDataIdFromObject,
} from "@apollo/client";
import { SchemaLink } from "@apollo/client/link/schema";
import { DB } from "./db";
import { makeExecutableSchema } from "@graphql-tools/schema";
import { connectionFromArray } from "graphql-relay";

import { Resolvers } from "./graphql/resolver-typings";
import {
  getPossibleTypesAndDataIdFromNode,
  typePoliciesWithGlobalObjectIdStoreKeys,
} from "@graphitation/apollo-react-relay-duct-tape";
const schemaSource: string = require("../data/schema.graphql");

const TODOS_FIXTURE = `
01. Clean counter tops
02. Clean microwave inside/outside
03. Wipe down cabinets/hardware
04. Clean outside of appliances
05. Polish stainless steel appliances
06. Clean refrigerator inside
07. Clean range vent/filter
08. Clean and sanitize sinks
09. Sweep and wash floors
10. Clean windows/window treatments
11. Clean/polish table and chairs
12. Sweep/mop hard floors
13. Vacuum carpets/area rugs
14. Clean/sanitize sinks
15. Clean/sanitize tubs, shower, toilet
16. Clean mirrors and glass
17. Clean and polish fixtures
18. Dust light fixtures and bulbs
19. Wash floors
20. Change sheets
21. Dust furniture/shelves
22. Vacuum floor
23. Wash windows
24. Empty wastebaskets
25. Dust light fixtures
26. Put away clean laundry
27. Dust/mop baseboards
28. Dust all hard surfaces/shelves/blinds
29. Vacuum carpets/area rugs
30. Sweep/mop hard floors
31. Vacuum upholstered furniture
32. Polish wood
33. Clean windows/window treatments
34. Dust office surfaces/equipment
35. File or toss loose mail/paperwork
36. Clean windows/window treatments
37. Sweep/mop hard floors
38. Vacuum carpets/area rugs
39. Vacuum carpets/area rugs
40. Sweep/mop hard floors
41. Dust cobwebs; ceiling/baseboard
42. Clean windows/window treatments
43. Clean washer and dryer exteriors
44. Clean inside rim of washer
45. Change/clean lint traps
46. Dust light fixtures and bulbs
47. Empty wastebasket
48. Sweep and mop floor
49. Clean laundry sink and fixtures
50. Clean laundry counter/hamper
51. Empty wastebaskets
52. Organize/dust shelves
53. Sweep/mop floor
54. Put away tools/supplies
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
        case "Me": {
          return { __typename: "Me", id: "Me:1" };
        }
      }
      return null;
    },
    me: (_source, _args, context) => {
      return { __typename: "Me", id: "Me:1" };
    },
  },
  Me: {
    todos: async (_source, args, context, info) => {
      if (info.operation.name?.value === "TodoListPaginationQuery") {
        // Synthetically make pagination take some time, so we can show a
        // loading indicator.
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
      const todos = [...context.db.getTodos()].sort((a, b) => {
        if (args?.sortBy?.sortDirection === "DESC") {
          return b.description.localeCompare(a.description);
        }
        return a.description.localeCompare(b.description);
      });
      return connectionFromArray(todos, args);
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
        input.isCompleted,
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
        })),
    ),
  };
  const { possibleTypes, dataIdFromNode } =
    getPossibleTypesAndDataIdFromNode(schema);
  return new ApolloClient({
    link: new SchemaLink({ schema, context }),
    cache: new InMemoryCache({
      possibleTypes,
      dataIdFromObject(responseObject, keyFieldsContext) {
        return (
          dataIdFromNode(responseObject, keyFieldsContext) ||
          defaultDataIdFromObject(responseObject, keyFieldsContext)
        );
      },
      typePolicies: typePoliciesWithGlobalObjectIdStoreKeys,
    }),
  });
}
