#!/usr/bin/env node

(function () {
  require("@graphitation/supermassive/lib/bin/typeDefsToImplicitResolvers")
    .typeDefsToImplicitResolvers()
    .parseAsync(process.argv);
})();
