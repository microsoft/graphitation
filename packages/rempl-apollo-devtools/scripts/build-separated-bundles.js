const esbuild = require("esbuild");
var { readFileSync } = require("fs");
var { resolve } = require("path");

if (require.main === module) {
  (async () => {
    return [
      esbuild.buildSync({
        entryPoints: ["src/publisher/index.ts"],
        write: true,
        bundle: true,
        minify: true,
        sourcemap: false,
        outfile: "dist/apollo-devtools-publisher.js",
        format: "iife",
      }),
      esbuild.buildSync({
        entryPoints: ["src/subscriber/index.tsx"],
        write: true,
        minify: true,
        bundle: true,
        outfile: "dist/apollo-devtools-subscriber.js",
        format: "esm",
        sourcemap: false,
        define: {
          __GRAPHIQL_CSS__: JSON.stringify(
            readFileSync(
              resolve(process.cwd(), "scripts/graphiql.min.css"),
              "utf8",
            ),
          ),
          __GLOBAL_CSS__: JSON.stringify(
            readFileSync(
              resolve(process.cwd(), "src/subscriber/styles.css"),
              "utf8",
            ),
          ),
        },
      }),
    ];
  })();
}
