import type {
  SchemaFragment,
  SchemaFragmentLoader,
  SchemaFragmentRequest,
} from "../types";
import type { PromiseOrValue } from "../jsutils/PromiseOrValue";

export interface SchemaFragmentLoaderContext {
  contextValue: unknown;
  schemaFragment: SchemaFragment;
  schemaFragmentLoader?: SchemaFragmentLoader;
}

export function requestSchemaFragment(
  exeContext: SchemaFragmentLoaderContext,
  request: SchemaFragmentRequest,
): PromiseOrValue<void> {
  if (!exeContext.schemaFragmentLoader) {
    return;
  }
  const currentSchemaId = exeContext.schemaFragment.schemaId;
  return exeContext
    .schemaFragmentLoader(
      exeContext.schemaFragment,
      exeContext.contextValue,
      request,
    )
    .then(({ mergedFragment, mergedContextValue }) => {
      if (currentSchemaId !== mergedFragment.schemaId) {
        throw new Error(
          `Cannot use new schema fragment: old and new fragments describe different schemas:` +
            ` ${currentSchemaId} vs. ${mergedFragment.schemaId}`,
        );
      }
      exeContext.contextValue = mergedContextValue ?? exeContext.contextValue;
      exeContext.schemaFragment = mergedFragment;
    });
}
