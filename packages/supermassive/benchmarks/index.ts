import fs from "fs";
import path from "path";
import NiceBenchmark from "./nice-benchmark";
import schema from "./swapi-schema";
import models from "./swapi-schema/models";
import { graphql, execute, parse } from "graphql";
import { compileQuery, isCompiledQuery } from "graphql-jit";

const query = fs.readFileSync(
  path.join(__dirname, "./fixtures/query1.graphql"),
  {
    encoding: "utf-8",
  }
);

const parsedQuery = parse(query);

const compiledQuery = compileQuery(schema, parsedQuery);

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
  const result = await execute({
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

const queryParsingSuite = new NiceBenchmark("Query parsing");
queryParsingSuite.add("graphql-js", async () => {
  parse(query);
});

const queryCompilingSuite = new NiceBenchmark("Query compiling");
queryCompilingSuite.add("graphql-jit", async () => {
  await compileQuery(schema, parsedQuery);
});

async function main() {
  await queryParsingSuite.run();
  await queryCompilingSuite.run();
  await queryRunningSuite.run();
}

main();
