import fs from "fs";
import path from "path";
import { getReliabilityStats } from "./reliability";
import { BenchmarkReport } from "./types";

export const log = {
  start() {
    console.log("🚀 Starting benchmark runs");
  },
  attempt(n: number) {
    console.log(`🔁 Attempt ${n}`);
  },
  stable(cur: number, req: number) {
    console.log(`✅ Stable (${cur}/${req})`);
  },
  variation() {
    console.log("⚠️ Variation detected – running more tests");
  },
  aggregated(runs: number, cfgs: number) {
    console.log(
      `📊 Aggregated ${runs} run(s) across ${cfgs} cache configuration(s)`,
    );
  },
  reportSaved(path: string) {
    console.log(`💾 Report saved: ${path}`);
  },
  noResults() {
    console.log("❌ No results to report");
  },
};

export const printResult = (result: BenchmarkReport | undefined) => {
  if (!result) {
    log.noResults();
    return;
  }

  const reportPath = path.join(
    __dirname,
    `benchmark-report-${Date.now()}.json`,
  );
  fs.writeFileSync(
    reportPath,
    JSON.stringify(getReliabilityStats(result), null, 2),
  );
  log.reportSaved(reportPath);
};
