import type {
  OperationDescriptor,
  PossibleSelection,
  PossibleSelections,
  ResponsePath,
} from "../descriptor/types";
import type { SourceObject } from "../values/types";
import type { SubsequentIncrementalExecutionResult } from "./types";
import { resolveSelection } from "../descriptor/resolvedSelection";

export function isDeferTarget(
  operation: OperationDescriptor,
  selection: PossibleSelection,
): boolean {
  const variables = operation.variablesWithDefaults;
  return (
    selection.deferConditions?.some((conditions) =>
      conditions.every(({ variable, directive }) =>
        directive === "defer"
          ? variables[variable] !== false
          : Boolean(variables[variable]) === (directive === "include"),
      ),
    ) ?? false
  );
}

// Parents may introduce a defer site targeted by another entry in the same payload.
export function assemble(
  operation: OperationDescriptor,
  data: SourceObject,
  payload: SubsequentIncrementalExecutionResult,
): SourceObject {
  const patches = (payload.incremental ?? []).flatMap((entry) =>
    "data" in entry && isObject(entry.data) && entry.path
      ? [{ path: entry.path, data: entry.data }]
      : [],
  );
  for (const patch of patches.sort((a, b) => a.path.length - b.path.length)) {
    const merged = mergeAt(
      data,
      operation.possibleSelections,
      patch.path,
      0,
      patch.data,
    );
    if (isObject(merged)) data = merged;
  }
  return data;

  function mergeAt(
    value: unknown,
    selections: PossibleSelections,
    path: ResponsePath,
    index: number,
    incoming: SourceObject,
  ): unknown {
    const step = path[index];
    if (Array.isArray(value) && typeof step === "number") {
      const child = mergeAt(value[step], selections, path, index + 1, incoming);
      if (child === undefined) return undefined;
      const copy = [...value];
      copy[step] = child;
      return copy;
    }
    if (!isObject(value)) return undefined;
    const selection = resolveSelection(
      operation,
      selections,
      value.__typename ?? (index === 0 ? operation.rootType : null),
    );
    if (index === path.length) {
      return isDeferTarget(operation, selection)
        ? mergeValues(value, incoming)
        : undefined;
    }
    const field = selection.fieldQueue.find((field) => field.dataKey === step);
    if (!field?.selection) return undefined;
    const child = mergeAt(
      value[step],
      field.selection,
      path,
      index + 1,
      incoming,
    );
    return child === undefined ? undefined : { ...value, [step]: child };
  }
}

// Overlapping fragments describe the same server lists, regardless of local order.
function mergeValues(existing: unknown, incoming: unknown): unknown {
  if (isObject(existing) && isObject(incoming)) {
    return {
      ...existing,
      ...Object.fromEntries(
        Object.entries(incoming).map(([key, value]) => [
          key,
          mergeValues(existing[key], value),
        ]),
      ),
    };
  }
  if (Array.isArray(existing) && Array.isArray(incoming)) {
    const result = [...existing];
    incoming.forEach((value, i) => {
      result[i] = mergeValues(existing[i], value);
    });
    return result;
  }
  return incoming;
}

function isObject(value: unknown): value is SourceObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
