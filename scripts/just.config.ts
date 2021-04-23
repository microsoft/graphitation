import { tscTask, esbuildTask, jestTask, eslintTask, argv } from "just-scripts";
import * as path from "path";
import * as glob from "fast-glob";

export const types = tscTask({ emitDeclarationOnly: true });

export const build = () =>
  esbuildTask({
    entryPoints: glob.sync("src/**/*.ts"),
    outdir: "lib",
  });

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
