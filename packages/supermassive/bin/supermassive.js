#!/usr/bin/env node

(function () {
  require("../lib/cjs/bin/supermassive")
    .supermassive()
    .parseAsync(process.argv);
})();
