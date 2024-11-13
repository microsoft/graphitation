const { execSync } = require("child_process");

async function runOnce(enableForestRun) {
  const args = ["--expose-gc", "run.js"];
  if (enableForestRun) {
    args.push("--enable-forest-run");
  }
  const command = `node ${args.join(" ")} run.js`;
  const output = execSync(command).toString();

  const [withFr, heapUsedStr] = output.split("|");

  if (!["ic", "fr"].includes(withFr) || isNaN(Number(heapUsedStr))) {
    throw new Error("Unexpected output");
  }

  return { fr: withFr === "fr", heapUsed: Number(heapUsedStr) };
}

async function runSeries(enableForestRun) {
  const iterations = [];
  console.log(
    `Running benchmark for ${enableForestRun ? "ForestRun" : "InMemoryCache"}`,
  );
  for (let i = 0; i < 10; i++) {
    console.log(`Iteration #${i}`);
    const result = await runOnce(enableForestRun);
    iterations.push(result);
  }
  console.log("Done");
  const sum = iterations.reduce(
    (acc, iteration) => acc + iteration.heapUsed,
    0,
  );
  return {
    jsHeapAvg: sum / iterations.length,
  };
}

async function run() {
  const withFR = await runSeries(true);
  const withIC = await runSeries(false);

  const delta = withIC.jsHeapAvg - withFR.jsHeapAvg;
  const percent = (delta * 100) / withIC.jsHeapAvg;
  const result = `Version with ForestRun has ${percent.toFixed(
    1,
  )}% smaller JS heap`;

  console.info({ withFR, withIC });
  console.log(``);
  console.log(result);
}

run().catch(console.error);
