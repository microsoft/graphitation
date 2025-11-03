import { Resolvers } from "../types";
import { isObjectLike } from "../jsutils/isObjectLike";

/**
 * Subtracts resolvers from minuend that exist in subtrahend.
 * Returns a new Resolvers object without mutating inputs.
 *
 * @param minuend - The resolvers to subtract from
 * @param subtrahend - The resolvers to subtract (can be single object or array)
 * @returns A new Resolvers object with resolvers from minuend not in subtrahend
 */
export function subtractResolvers(
  minuend: Resolvers,
  subtrahend: Resolvers | Resolvers[],
): Resolvers {
  const result: Resolvers = {};

  // Flatten subtrahend if it's an array
  const subtrahends = flattenResolvers(subtrahend);

  // Process each type in minuend
  for (const [typeName, typeResolver] of Object.entries(minuend)) {
    if (!isObjectLike(typeResolver)) {
      // Skip non-object resolvers
      continue;
    }

    const subtractedTypeResolver = subtractTypeResolver(
      typeResolver,
      subtrahends,
      typeName,
    );

    // Only include type if it has remaining resolvers
    if (
      subtractedTypeResolver &&
      Object.keys(subtractedTypeResolver).length > 0
    ) {
      result[typeName] = subtractedTypeResolver;
    }
  }

  return result;
}

/**
 * Flattens an array of resolvers (including nested arrays) into a single array.
 */
function flattenResolvers(resolvers: Resolvers | Resolvers[]): Resolvers[] {
  if (!Array.isArray(resolvers)) {
    return [resolvers];
  }

  const result: Resolvers[] = [];
  for (const entry of resolvers) {
    if (Array.isArray(entry)) {
      result.push(...flattenResolvers(entry));
    } else {
      result.push(entry);
    }
  }
  return result;
}

/**
 * Subtracts field resolvers from a type resolver.
 */
function subtractTypeResolver(
  typeResolver: Record<string, unknown>,
  subtrahends: Resolvers[],
  typeName: string,
): Record<string, unknown> | null {
  const result: Record<string, unknown> = {};

  // Get all field names to subtract
  const fieldsToSubtract = new Set<string>();
  for (const subtrahend of subtrahends) {
    const subtrahendTypeResolver = subtrahend[typeName];
    if (isObjectLike(subtrahendTypeResolver)) {
      for (const fieldName of Object.keys(subtrahendTypeResolver)) {
        fieldsToSubtract.add(fieldName);
      }
    }
  }

  // Copy fields that are not in subtrahend
  for (const [fieldName, fieldResolver] of Object.entries(typeResolver)) {
    if (!fieldsToSubtract.has(fieldName)) {
      result[fieldName] = fieldResolver;
    }
  }

  return Object.keys(result).length > 0 ? result : null;
}
