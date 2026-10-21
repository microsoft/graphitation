// Runs `src/**/*.test.ts` with node:test, transpiled by tsx. Node 20 does not
// expand globs for `--test`, so the files are listed here.
import { spawnSync } from "node:child_process";
import { readdirSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));

function findTests(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return findTests(path);
    return entry.name.endsWith(".test.ts") ? [relative(root, path)] : [];
  });
}

const result = spawnSync(
  process.execPath,
  [
    "--import",
    "tsx",
    "--import",
    "./src/__tests__/fast-check.setup.ts",
    "--test",
    ...process.argv.slice(2),
    ...findTests(join(root, "src")).sort(),
  ],
  { cwd: root, stdio: "inherit" },
);
process.exitCode = result.status ?? 1;
