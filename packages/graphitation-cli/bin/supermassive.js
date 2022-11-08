#!/usr/bin/env node

(function () {
  require("@graphitation/graphitation-cli/lib/supermassive")
    .supermassive()
    .parseAsync(process.argv);
})();
