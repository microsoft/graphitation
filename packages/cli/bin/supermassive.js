#!/usr/bin/env node

(function () {
  console.warn("DEPRECATED - use graphitation command");
  require("@graphitation/cli/lib/graphitation")
    .graphitation()
    .parseAsync(process.argv);
})();
