import fs from "fs";
import path from "path";
import NiceBenchmark from "./nice-benchmark";
import schema from "./swapi-schema";
import resolvers from "./swapi-schema/resolvers";
import models from "./swapi-schema/models";
import {
  graphql,
  execute as graphqlExecute,
  parse,
  isInputType,
} from "graphql";
import { compileQuery, isCompiledQuery } from "graphql-jit";
import { executeWithoutSchema as supermassiveExecute } from "../executeWithoutSchema";
import { addTypesToRequestDocument } from "@graphitation/supermassive-ast";
import { Resolvers, UserResolvers } from "../types";
import { extractImplicitTypes } from "../extractImplicitTypesRuntime";
import { specifiedScalars } from "../values";

const query = fs.readFileSync(
  path.join(__dirname, "./fixtures/query1.graphql"),
  {
    encoding: "utf-8",
  },
);

const parsedQuery = parse(query);

const compiledQuery = compileQuery(schema, parsedQuery);

const typeAnnotatedQuery = addTypesToRequestDocument(schema, parsedQuery);

const queryRunningSuite = new NiceBenchmark("Query Running");
queryRunningSuite.add("graphql-js - string queries", async () => {
  const result = await graphql({
    schema,
    source: query,
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
  let extractedResolvers: Resolvers = {};
  const getTypeByName = (name: string) => {
    const type = specifiedScalars[name] || extractedResolvers[name];
    if (isInputType(type)) {
      return type;
    } else {
      throw new Error("Invalid type");
    }
  };
  extractedResolvers = extractImplicitTypes(parsedQuery, getTypeByName);

  const result = await supermassiveExecute({
    resolvers: resolvers as UserResolvers,
    schemaResolvers: extractedResolvers,
    document: typeAnnotatedQuery,
    contextValue: { models },
  });
  if (result.errors || !result.data) {
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
  addTypesToRequestDocument(schema, parsedQuery);
});

async function main() {
  await queryCompilingSuite.run();
  await queryParsingSuite.run();
  await queryAnnotationSuite.run();
  await queryRunningSuite.run();
}

main();
