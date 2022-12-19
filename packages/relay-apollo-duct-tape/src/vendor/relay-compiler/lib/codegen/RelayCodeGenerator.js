/**
 * Copyright (c) Facebook, Inc. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 *
 * @format
 */
// flowlint ambiguous-object-type:error
"use strict";

import NormalizationCodeGenerator from "./NormalizationCodeGenerator";

import ReaderCodeGenerator from "./ReaderCodeGenerator";

import sortObjectByKey from "./sortObjectByKey";

import md5 from "../util/md5";

import nullthrows from "nullthrows";

import { createCompilerError } from "../core/CompilerError";

function generate(schema, node) {
  switch (node.kind) {
    case "Fragment":
      if (node.metadata?.inlineData === true) {
        return {
          kind: "InlineDataFragment",
          name: node.name,
        };
      }

      return ReaderCodeGenerator.generate(schema, node);

    case "Request":
      return {
        fragment: ReaderCodeGenerator.generate(schema, node.fragment),
        kind: "Request",
        operation: NormalizationCodeGenerator.generate(schema, node.root),
        params:
          node.id != null
            ? {
                id: node.id,
                metadata: sortObjectByKey(node.metadata),
                name: node.name,
                operationKind: node.root.operation,
              }
            : {
                cacheID: md5(nullthrows(node.text)),
                metadata: sortObjectByKey(node.metadata),
                name: node.name,
                operationKind: node.root.operation,
                text: node.text,
              },
      };

    case "SplitOperation":
      return NormalizationCodeGenerator.generate(schema, node);
  }

  throw createCompilerError(
    `RelayCodeGenerator: Unknown AST kind '${node.kind}'.`,
    [node.loc],
  );
}

module.exports = {
  generate,
};
