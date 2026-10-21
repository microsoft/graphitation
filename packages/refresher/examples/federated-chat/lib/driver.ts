/**
 * The simple driver ships in `src/queries` but `@graphitation/refresher` does not export it, so the
 * example reaches for it directly.
 */
export { createSimpleDriver } from "../../../src/queries/simpleDriver";
export type { SimpleDriverOutput } from "../../../src/queries/simpleDriver";
