// Network-mount scenario: MESSAGES x HOOKS cache-first queries, each selecting a single field
// of `Message:i` via `message(id)`. All queries are watched while their requests are in flight
// (as Apollo QueryInfo does), and responses arrive one at a time.
//
// Usage (after `yarn build`): node benchmarks/pending-watches/run.js [messages] [hooks] [runs]
const { parse } = require("graphql");
const { ForestRun } = require("../../lib/ForestRun");

const MESSAGES = Number(process.argv[2] ?? 20);
const HOOKS = Number(process.argv[3] ?? 20);
const RUNS = Number(process.argv[4] ?? 5);

const queries = Array.from({ length: HOOKS }, (_, h) =>
  parse(`query Hook${h}($id: ID!) { message(id: $id) { id field${h} } }`),
);

function runOnce() {
  const cache = new ForestRun();
  // Every (re-)hydration of an operation read result ends up in `readResults.set`
  const readResults = cache.store.dataForest.readResults;
  const set = readResults.set;
  let reads = 0;
  readResults.set = function (...args) {
    reads++;
    return set.apply(this, args);
  };

  const watches = [];
  let notifications = 0;
  for (let m = 0; m < MESSAGES; m++) {
    for (let h = 0; h < HOOKS; h++) {
      const watch = {
        query: queries[h],
        variables: { id: String(m) },
        optimistic: true,
        returnPartialData: true,
        callback: (diff) => {
          notifications++;
          watch.lastDiff = diff;
        },
      };
      cache.watch(watch);
      watch.lastDiff = cache.diff(watch);
      watches.push(watch);
    }
  }
  const initialReads = reads;
  reads = 0;

  const start = performance.now();
  for (let m = 0; m < MESSAGES; m++) {
    for (let h = 0; h < HOOKS; h++) {
      cache.write({
        query: queries[h],
        variables: { id: String(m) },
        result: {
          message: { __typename: "Message", id: String(m), [`field${h}`]: h },
        },
      });
    }
  }
  const time = performance.now() - start;

  const complete = watches.filter((w) => w.lastDiff.complete).length;
  return { time, reads, initialReads, notifications, complete };
}

const results = Array.from({ length: RUNS }, runOnce);
const times = results.map((r) => r.time).sort((a, b) => a - b);
const { reads, initialReads, notifications, complete } = results[0];
console.log(
  JSON.stringify({
    watches: MESSAGES * HOOKS,
    medianMs: Number(times[Math.floor(times.length / 2)].toFixed(1)),
    minMs: Number(times[0].toFixed(1)),
    rehydrations: reads,
    initialReads,
    notifications,
    complete,
  }),
);
