#!/usr/bin/env node

/**
 * This trampoline allows dependent packages inside this monorepo to use this
 * CLI tool without first needing to compile the TypeScript code to CommonJS
 * for Node to consume.
 *
 * It relies on the `bin` entry of the `package.json` file to point to this
 * file, but be overwritten by a `publishConfig.bin` entry to point directly to
 * the compiled version of `cli.ts`.
 */

// Configure dynamic ts compiler
require("ts-node").register({
  project: require("path").resolve(__dirname, "../tsconfig.json"),
});
// Now load normal ts cli bin
require("./cli");
