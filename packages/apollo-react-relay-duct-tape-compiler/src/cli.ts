#!/usr/bin/env node

/* istanbul ignore file */

import * as yargs from "yargs";
import { relayCompiler } from "relay-compiler";
import { pluginFactory } from "./relayCompilerLanguagePlugin";

// TODO: This needs to be done here to ensure we get to mutate the transforms lists that get used.
import { IRTransforms } from "relay-compiler";
import { IRTransform } from "relay-compiler/lib/core/CompilerContext";
import { enableNodeWatchQueryTransform } from "./compilerTransforms/enableNodeWatchQueryTransform";
import { annotateFragmentReferenceTransform } from "./compilerTransforms/annotateFragmentReferenceTransform";
import { emitApolloClientConnectionTransform } from "./compilerTransforms/emitApolloClientConnectionTransform";
import { retainConnectionDirectiveTransform } from "./compilerTransforms/retainConnectionDirectiveTransform";

function wrapTransform(
  transformName: string,
  transforms: IRTransform[],
  wrapperTransform: (wrappedTransform: IRTransform) => IRTransform,
) {
  const transformIndex = transforms.findIndex(
    (transform) => transform.name === transformName,
  );
  const wrappedTransform = transforms[transformIndex];
  transforms[transformIndex] = wrapperTransform(wrappedTransform);
}

wrapTransform(
  "filterDirectivesTransform",
  IRTransforms.printTransforms,
  retainConnectionDirectiveTransform,
);
wrapTransform(
  "connectionTransform",
  IRTransforms.commonTransforms,
  emitApolloClientConnectionTransform,
);

async function main() {
  const argv = await yargs
    .scriptName("duct-tape-compiler")
    .options({
      src: {
        demandOption: false,
        default: ".",
        type: "string",
      },
      exclude: {
        demandOption: false,
        type: "string",
        array: true,
      },
      include: {
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
      emitDocuments: {
        demandOption: false,
        default: true,
        type: "boolean",
      },
      emitNarrowObservables: {
        demandOption: false,
        default: true,
        type: "boolean",
      },
      emitQueryDebugComments: {
        demandOption: false,
        default: false,
        type: "boolean",
      },
      emitSupermassiveDocuments: {
        demandOption: false,
        default: false,
        type: "boolean",
      },
      supermassiveDocumentNodeOutputType: {
        demandOption: false,
        default: "V2",
        type: "string",
        coerce: (value) => {
          switch (value) {
            case "V2":
              return "V2";
            case "V3":
              return "V3";
            case "BOTH":
              return "BOTH";
            default:
              return "V2";
          }
        },
      },
    })
    .help().argv;

  if (!argv.emitDocuments) {
    argv.emitNarrowObservables = false;
    argv.emitQueryDebugComments = false;
  }

  if (argv.emitNarrowObservables) {
    // TODO: Moving this up in the list might potentially optimize the query further
    IRTransforms.printTransforms.push(annotateFragmentReferenceTransform);
    IRTransforms.commonTransforms.unshift(enableNodeWatchQueryTransform);
  }

  const ductTapeCompilerLanguagePlugin = await pluginFactory(argv);

  return relayCompiler({
    ...argv,
    language: ductTapeCompilerLanguagePlugin,
    extensions: ["ts", "tsx"], // FIXME: Why is this not taken from the language plugin?
    include: argv.include || ["**"],
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
