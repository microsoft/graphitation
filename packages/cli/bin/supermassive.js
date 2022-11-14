#!/usr/bin/env node

(function () {
  require("@graphitation/cli/lib/supermassive")
    .supermassive()
    .parseAsync(process.argv);
})();
