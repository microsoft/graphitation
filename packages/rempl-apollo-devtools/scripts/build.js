const esbuild = require("esbuild");
var { readFileSync } = require("fs");
var { resolve } = require("path");

if (require.main === module) {
  (async () => {
    const __APOLLO_DEVTOOLS_SUBSCRIBER__ = (
      await esbuild.build({
        entryPoints: ["src/subscriber/index.tsx"],
        write: false,
        minify: false,
        bundle: true,
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
      })
    ).outputFiles[0].text;

    return esbuild.buildSync({
      entryPoints: ["src/publisher/index.ts"],
      write: true,
      bundle: true,
      minify: true,
      sourcemap: false,
      outfile: "dist/apollo-devtools.js",
      format: "iife",
      define: {
        __APOLLO_DEVTOOLS_SUBSCRIBER__: JSON.stringify(
          __APOLLO_DEVTOOLS_SUBSCRIBER__,
        ),
      },
    });
  })();
}
