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
        format: "iife",
        sourcemap: true,
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

    return esbuild.build({
      entryPoints: ["src/publisher/index.ts"],
      write: true,
      bundle: true,
      minify: false,
      sourcemap: false,
      outfile:
        "../../examples/apollo-devtools-playground/public/apollo-devtools.js",
      format: "iife",
      define: {
        __APOLLO_DEVTOOLS_SUBSCRIBER__: JSON.stringify(
          __APOLLO_DEVTOOLS_SUBSCRIBER__,
        ),
      },
    });
  })();
}
