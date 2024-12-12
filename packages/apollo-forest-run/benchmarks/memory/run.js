const { InMemoryCache, gql } = require("@apollo/client");
const { ForestRun } = require("../../lib/ForestRun");

const query = gql`
  query firstQuery($id: ID!) {
    node(id: $id) {
      id
    }
  }
`;
const maxOperationCount = 100;

function createCache(enableForestRun = false) {
  return enableForestRun
    ? new ForestRun({ maxOperationCount })
    : new InMemoryCache({ resultCacheMaxSize: 0 });
}

function createResult(op, variables) {
  const node = {
    __typename: "SomeNode",
    id: String(op),
  };
  return { __typename: "Query", node };
}

async function run(enableForestRun, operations = 1000) {
  // console.log(
  //   `Running with: enableForestRun: ${enableForestRun}, iterations: ${iterations}`,
  // );
  const cache = createCache(enableForestRun);
  for (let op = 0; op < operations; op++) {
    const variables = { id: createRandomString(1024) };
    cache.write({
      query,
      variables,
      result: createResult(op, variables),
    });
  }
  if (!enableForestRun) {
    for (let i = maxOperationCount; i < operations; i++) {
      cache.evict({
        id: "ROOT_QUERY",
        fieldName: "node",
        args: { id: String(i) },
      });
    }
    cache.gc();
  }
  // cache.reset();
  global.gc();

  const memory = process.memoryUsage();
  console.log(`${enableForestRun ? "fr" : "ic"}|${memory.heapUsed}`);
}

const chars = "qwerty123456789".split("");
function createRandomString(length) {
  let str = [];
  // console.log(length);
  for (let i = 0; i < length; i++) {
    const charIndex = Math.round(Math.random() * 1000) % chars.length;
    str.push(chars[charIndex]);
  }
  return str.join("");
}

run(process.argv.some((arg) => arg === "--enable-forest-run"));
