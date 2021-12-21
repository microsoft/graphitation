declare module "relay-compiler/lib/transforms/FilterDirectivesTransform" {
  import { IRTransform } from "relay-compiler/lib/core/CompilerContext";
  export const transform: IRTransform;
}

declare module "relay-compiler/lib/transforms/ConnectionTransform" {
  import { IRTransform } from "relay-compiler/lib/core/CompilerContext";
  export const transform: IRTransform;
  export const SCHEMA_EXTENSION: string;
}
