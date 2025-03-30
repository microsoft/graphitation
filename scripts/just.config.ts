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
import * as fs from "fs";
import { transformFileSync } from "@babel/core";
import { inlineAssert } from "./inline-assert";

export const types = () => {
  return tscTask({
    outDir: "lib",
    emitDeclarationOnly: true,
  });
};

export const build = () => {
  const baseEsbuildOptions: EsbuildBuildOptions = {
    entryPoints: glob.sync(["src/**/*.{ts,tsx}", "!src/**/__tests__/**"]),
    outdir: "lib",
    target: "es2018",
    sourcemap: "external",
  };
  return parallel(
    esbuildTask({
      ...baseEsbuildOptions,
      format: "esm",
      bundle: true,
      outExtension: { ".js": ".mjs" },
      plugins: [
        {
          name: "inline-assert",
          setup(build) {
            // TODO: switch to SWC or tree-sitter
            build.onLoad({ filter: /apollo-forest-run/ }, async (args) => {
              const result = transformFileSync(args.path, {
                filename: args.path,
                presets: ["@babel/preset-typescript"],
                plugins: [inlineAssert()],
                sourceMaps: "inline",
              });
              return {
                contents: result?.code ?? undefined,
                loader: args.path.endsWith(".ts") ? "ts" : "js",
              };
            });
          },
        },
        {
          name: "add-mjs",
          setup(build) {
            build.onResolve({ filter: /.*/ }, (args) => {
              if (args.importer) {
                let extPath = args.path;
                if (extPath.startsWith(".")) {
                  const absolutePath = path.resolve(
                    args.importer,
                    "..",
                    extPath,
                  );
                  if (
                    fs.existsSync(absolutePath) &&
                    fs.lstatSync(absolutePath).isDirectory()
                  ) {
                    extPath = extPath + "/index.mjs";
                  } else {
                    extPath = extPath + ".mjs";
                  }
                }
                return {
                  path: extPath,
                  namespace: "magic",
                  external: true,
                };
              }
            });
          },
        },
      ],
    }),
    esbuildTask({
      ...baseEsbuildOptions,
      format: "cjs",
    }),
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
