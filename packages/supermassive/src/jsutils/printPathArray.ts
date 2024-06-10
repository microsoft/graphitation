/**
 * Build a string describing the path.
 */
export function printPathArray(path: ReadonlyArray<string | number>): string {
  let result = "";
  for (let i = 0; i < path.length; i++) {
    if (typeof path[i] === "number") {
      result += `[${path[i].toString()}]`;
    } else {
      if (i > 0) {
        result += ".";
      }
      result += path[i];
    }
  }
  return result;
}
