import { GraphQLList, getNullableType } from "graphql";
import type { GraphQLOutputType } from "graphql";

export function getArrayDepthFromType(type: GraphQLOutputType) {
  let depth = 0;
  let currentType = getNullableType(type);

  while (currentType instanceof GraphQLList) {
    depth += 1;
    currentType = getNullableType(currentType.ofType);
  }

  return depth;
}

export function wrapInArray(value: unknown, depth: number) {
  let result = value;

  for (let i = 0; i < depth; i++) {
    result = [result];
  }

  return result;
}

export function applyLogicToNestedArray<T, U>(
  value: T | T[],
  someLogic: (item: T) => U,
): U | U[] {
  if (Array.isArray(value)) {
    return value.map((element) =>
      applyLogicToNestedArray(element, someLogic),
    ) as U[];
  } else {
    return someLogic(value);
  }
}
