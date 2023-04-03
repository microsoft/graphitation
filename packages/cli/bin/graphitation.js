#!/usr/bin/env node

(function () {
  require("@graphitation/cli/lib/graphitation")
    .graphitation()
    .parseAsync(process.argv);
})();
