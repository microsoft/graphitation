import { Schema } from "relay-compiler/lib/core/Schema";
import { Fragment, SplitOperation, Request } from "relay-compiler/lib/core/IR";
import {
  ReaderFragment,
  ConcreteRequest,
  NormalizationSplitOperation,
} from "relay-runtime";

export function generate(schema: Schema, node: Fragment): ReaderFragment;
export function generate(schema: Schema, node: Request): ConcreteRequest;
export function generate(
  schema: Schema,
  node: SplitOperation,
): NormalizationSplitOperation;
