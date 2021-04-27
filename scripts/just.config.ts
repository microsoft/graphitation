import {
  tscTask,
  esbuildTask,
  jestTask,
  eslintTask,
  argv,
  parallel,
  EsbuildBuildOptions,
} from "just-scripts";
import * as path from "path";
import * as glob from "fast-glob";

export const types = tscTask({ emitDeclarationOnly: true });

export const build = () => {
  const baseEsbuildOptions: EsbuildBuildOptions = {
    entryPoints: glob.sync(["src/**/*.{ts,tsx}", "!src/**/__tests__/**"]),
    outdir: "lib",
    target: "es6",
  };
  return parallel(
    esbuildTask({
      ...baseEsbuildOptions,
      format: "esm",
      outExtension: { ".js": ".mjs" },
    }),
    esbuildTask({
      ...baseEsbuildOptions,
      format: "cjs",
    })
  );
};

export const test = () => {
  return jestTask({
    config: path.join(__dirname, "config", "jest.config.js"),
    watch: argv().watch,
    _: argv()._,
  });
};

export const lint = eslintTask({
  files: [path.join(process.cwd(), "src")],
  extensions: ".ts,.tsx",
  cache: true,
  fix: process.argv.includes("--fix"),
  timing: process.argv.includes("--timing"),
});
