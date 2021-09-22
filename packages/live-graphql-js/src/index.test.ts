import {
  execute,
  GraphQLObjectType,
  GraphQLSchema,
  GraphQLString,
  parse,
} from "graphql";

const schema = new GraphQLSchema({
  query: new GraphQLObjectType({
    name: "Query",
    fields: {
      rootField: {
        type: GraphQLString,
        resolve: () => {
          const iter: AsyncIterable<number> = {
            [Symbol.asyncIterator]() {
              let current = 1;
              const last = 5;
              return {
                async next() {
                  await new Promise((resolve) => setTimeout(resolve, 100));
                  if (current <= last) {
                    return { done: false, value: current++ };
                  } else {
                    return { done: true, value: undefined };
                  }
                },
              };
            },
          };
          return iter;
        },
      },
    },
  }),
});

describe("bar", () => {
  it("returns a string", async () => {
    const result = await execute({
      schema,
      document: parse(`
        query {
          rootField
        }
      `),
    });
    console.log(result);
  });
});
