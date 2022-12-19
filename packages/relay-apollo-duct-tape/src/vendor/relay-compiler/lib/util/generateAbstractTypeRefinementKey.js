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

import { createCompilerError } from "../core/CompilerError";

function generateAbstractTypeRefinementKey(schema, type) {
  if (!schema.isAbstractType(type)) {
    throw createCompilerError("Expected an abstract type");
  }

  return `__is${schema.getTypeString(type)}`;
}

export default generateAbstractTypeRefinementKey;
