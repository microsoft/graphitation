import fs from "fs";
import path from "path";
import NiceBenchmark from "./nice-benchmark";
import schema from "./swapi-schema";
import resolvers from "./swapi-schema/resolvers";
import models from "./swapi-schema/models";
import {
  execute as graphqlExecute,
  parse,
  // experimentalExecuteIncrementally as graphqlExecute,
} from "graphql";
import { compileQuery, isCompiledQuery } from "graphql-jit";
import { executeWithoutSchema as supermassiveExecute } from "../executeWithoutSchema";
import { UserResolvers, SchemaFragment } from "../types";
import { extractMinimalViableSchemaForRequestDocument } from "../utilities/extractMinimalViableSchemaForRequestDocument";

const query = fs.readFileSync(
  path.join(__dirname, "./fixtures/query1.graphql"),
  {
    encoding: "utf-8",
  },
);

const parsedQuery = parse(query);
const compiledQuery = compileQuery(schema, parsedQuery);

const { definitions } = extractMinimalViableSchemaForRequestDocument(
  schema,
  parsedQuery,
);

const schemaFragment: SchemaFragment = {
  schemaId: "benchmark",
  definitions,
  resolvers: resolvers as UserResolvers,
};

const queryRunningSuite = new NiceBenchmark("Query Running");
queryRunningSuite.add("graphql-js - string queries", async () => {
  const result = await graphqlExecute({
    schema,
    document: parse(query),
    contextValue: { models },
  });
  if (result.errors || !result.data) {
    throw new Error("Stuff ain't executing");
  }
});
queryRunningSuite.add("graphql-js - parsed queries", async () => {
  const result = await graphqlExecute({
    schema,
    document: parsedQuery,
    contextValue: { models },
  });
  if (result.errors || !result.data) {
    throw new Error("Stuff ain't executing");
  }
});
queryRunningSuite.add("graphql-jit - uncompiled", async () => {
  const freshCompiledQuery = compileQuery(schema, parsedQuery);
  if (isCompiledQuery(freshCompiledQuery)) {
    const result = await freshCompiledQuery.query({}, { models }, {});
    if (result.errors || !result.data) {
      throw new Error("Stuff ain't executing");
    }
  } else {
    throw new Error("Wrong query");
  }
});
queryRunningSuite.add("graphql-jit - precompiled", async () => {
  if (isCompiledQuery(compiledQuery)) {
    const result = await compiledQuery.query({}, { models }, {});
    if (result.errors || !result.data) {
      throw new Error("Stuff ain't executing");
    }
  } else {
    throw new Error("Wrong query");
  }
});
queryRunningSuite.add("supermassive - runtime schemaless", async () => {
  const result = await supermassiveExecute({
    schemaFragment,
    document: parsedQuery,
    contextValue: { models },
  });
  if ("data" in result && (result.errors || !result.data)) {
    throw new Error("Stuff ain't executing");
  }
});

queryRunningSuite.add(
  "supermassive - before operation execute sync hook - runtime schemaless",
  async () => {
    const result = await supermassiveExecute({
      schemaFragment,
      document: parsedQuery,
      fieldExecutionHooks: {
        beforeOperationExecute: ({ context }) => {
          (context as any).test = 0;
        },
      },
      contextValue: { models },
    });
    if ("data" in result && (result.errors || !result.data)) {
      throw new Error("Stuff ain't executing");
    }
  },
);

queryRunningSuite.add(
  "supermassive - before operation execute async hook - runtime schemaless",
  async () => {
    const result = await supermassiveExecute({
      schemaFragment,
      document: parsedQuery,
      fieldExecutionHooks: {
        beforeOperationExecute: async ({ context }) => {
          (context as any).test = 0;
        },
      },
      contextValue: { models },
    });
    if ("data" in result && (result.errors || !result.data)) {
      throw new Error("Stuff ain't executing");
    }
  },
);

queryRunningSuite.add(
  "supermassive - before field resolve sync hook - runtime schemaless",
  async () => {
    const result = await supermassiveExecute({
      schemaFragment,
      document: parsedQuery,
      fieldExecutionHooks: {
        beforeFieldResolve: ({ context }) => {
          (context as any).test = 0;
        },
      },
      contextValue: { models },
    });
    if ("data" in result && (result.errors || !result.data)) {
      throw new Error("Stuff ain't executing");
    }
  },
);

queryRunningSuite.add(
  "supermassive - before field resolve async hook - runtime schemaless",
  async () => {
    const result = await supermassiveExecute({
      schemaFragment,
      document: parsedQuery,
      fieldExecutionHooks: {
        beforeFieldResolve: async ({ context }) => {
          (context as any).test = 0;
        },
      },
      contextValue: { models },
    });
    if ("data" in result && (result.errors || !result.data)) {
      throw new Error("Stuff ain't executing");
    }
  },
);

const queryParsingSuite = new NiceBenchmark("Query parsing");
queryParsingSuite.add("graphql-js", async () => {
  parse(query);
});

const queryCompilingSuite = new NiceBenchmark("Query compiling");
queryCompilingSuite.add("graphql-jit", async () => {
  await compileQuery(schema, parsedQuery);
});

const queryAnnotationSuite = new NiceBenchmark("Query annotation");
queryAnnotationSuite.add("supermassive", () => {
  extractMinimalViableSchemaForRequestDocument(schema, parsedQuery);
});

async function main() {
  await queryCompilingSuite.run();
  await queryParsingSuite.run();
  await queryAnnotationSuite.run();
  await queryRunningSuite.run();
}

main();
