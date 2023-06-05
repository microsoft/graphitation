#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-var-requires */

const path = require("path");
const { addResolvePath } = require("just-scripts");
addResolvePath(path.join(__dirname, ".."));

// Calling the CLI
require("just-scripts/bin/just-scripts");
