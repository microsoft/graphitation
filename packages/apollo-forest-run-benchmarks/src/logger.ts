import fs from "fs";
import path from "path";
import { getSummary } from "./reliability";

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

export const printResult = (results: any) => {
  if (!results || (Array.isArray(results) && results.length === 0)) {
    log.noResults();
    return;
  }

  const reportPath = path.join(
    __dirname,
    `benchmark-report-${Date.now()}.json`,
  );
  fs.writeFileSync(reportPath, JSON.stringify(getSummary(results), null, 2));
  log.reportSaved(reportPath);
};
