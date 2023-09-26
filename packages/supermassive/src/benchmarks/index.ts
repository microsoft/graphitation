import { extractMinimalViableSchemaForRequestDocument } from "@graphitation/supermassive-ast";
import fs from "fs";
import { execute as graphqlExecute, parse } from "graphql";
import { compileQuery, isCompiledQuery } from "graphql-jit";
import path from "path";
import { executeWithoutSchema as supermassiveExecute } from "../executeWithoutSchema";
import { SchemaFragment, UserResolvers } from "../types";
import NiceBenchmark from "./nice-benchmark";
import schema from "./swapi-schema";
import models from "./swapi-schema/models";
import resolvers from "./swapi-schema/resolvers";

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
