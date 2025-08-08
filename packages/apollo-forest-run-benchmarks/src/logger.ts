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
};
