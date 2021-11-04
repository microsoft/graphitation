#!/usr/bin/env node

/* istanbul ignore file */

import * as yargs from "yargs";
import { relayCompiler } from "relay-compiler";

// TODO: This needs to be done here to ensure we get to mutate the transforms lists that get used.
import { IRTransforms } from "relay-compiler";
import { enableNodeWatchQueryTransform } from "./compilerTransforms/enableNodeWatchQueryTransform";
import { annotateFragmentReferenceTransform } from "./compilerTransforms/annotateFragmentReferenceTransform";
IRTransforms.commonTransforms.unshift(enableNodeWatchQueryTransform);
// TODO: Moving this up in the list might potentially optimize the query further
IRTransforms.printTransforms.push(annotateFragmentReferenceTransform);

function main() {
  const argv = yargs
    .scriptName("nova-graphql-compiler")
    .options({
      exclude: {
        demandOption: false,
        type: "string",
        array: true,
      },
      schema: {
        demandOption: true,
        type: "string",
      },
      validate: {
        demandOption: false,
        default: false,
        type: "boolean",
      },
      verbose: {
        demandOption: false,
        default: false,
        type: "boolean",
      },
      watch: {
        demandOption: false,
        default: false,
        type: "boolean",
      },
      watchman: {
        demandOption: false,
        default: true,
        type: "boolean",
      },
      quiet: {
        demandOption: false,
        default: false,
        type: "boolean",
      },
    })
    .help().argv;
  // First ensure the schema env var is set...
  if (process.env.SCHEMA_PATH === undefined) {
    process.env.SCHEMA_PATH = argv.schema;
  }
  // ...then load the language plugin, which looks for the schema path on module load (bad)
  const language = require("relay-compiler-language-graphitation");
  return relayCompiler({
    ...argv,
    language,
    src: ".",
    extensions: ["ts", "tsx"], // FIXME: Why is this not taken from the language plugin?
    include: ["**"],
    exclude: [
      "**/node_modules/**",
      "**/__mocks__/**",
      "**/__generated__/**",
      // relay-compiler will treat these as client-side schema extensions
      "**/*.graphql",
      ...(argv.exclude || []),
    ],
    noFutureProofEnums: true,
    customScalars: {},
  });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
