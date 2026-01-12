export type DiffLine = {
  type: "context" | "added" | "removed";
  oldLineNum: number | null;
  newLineNum: number | null;
  content: string;
};

export type DiffHunk = {
  oldStart: number;
  oldLines: number;
  newStart: number;
  newLines: number;
  lines: DiffLine[];
};

// LCS (Longest Common Subsequence) algorithm for better diff matching
function computeLCS(
  oldLines: string[],
  newLines: string[],
): Array<{ oldIndex: number; newIndex: number }> {
  const m = oldLines.length;
  const n = newLines.length;

  // Build LCS table
  const lcs: number[][] = Array(m + 1)
    .fill(0)
    .map(() => Array(n + 1).fill(0));

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (oldLines[i - 1] === newLines[j - 1]) {
        lcs[i][j] = lcs[i - 1][j - 1] + 1;
      } else {
        lcs[i][j] = Math.max(lcs[i - 1][j], lcs[i][j - 1]);
      }
    }
  }

  // Backtrack to find the actual LCS
  const matches: Array<{ oldIndex: number; newIndex: number }> = [];
  let i = m;
  let j = n;

  while (i > 0 && j > 0) {
    if (oldLines[i - 1] === newLines[j - 1]) {
      matches.unshift({ oldIndex: i - 1, newIndex: j - 1 });
      i--;
      j--;
    } else if (lcs[i - 1][j] > lcs[i][j - 1]) {
      i--;
    } else {
      j--;
    }
  }

  return matches;
}

// Simple diff algorithm using LCS - shows ALL lines with changes highlighted
export function computeDiff(oldText: string, newText: string): DiffHunk[] {
  const oldLines = oldText.split("\n");
  const newLines = newText.split("\n");

  // Use LCS to find matching lines
  const lcs = computeLCS(oldLines, newLines);

  const allLines: DiffLine[] = [];
  let oldIdx = 0;
  let newIdx = 0;

  // Build diff from LCS
  for (const match of lcs) {
    // Add deleted lines (in old but not in match)
    while (oldIdx < match.oldIndex) {
      allLines.push({
        type: "removed",
        oldLineNum: oldIdx + 1,
        newLineNum: null,
        content: oldLines[oldIdx],
      });
      oldIdx++;
    }

    // Add added lines (in new but not in match)
    while (newIdx < match.newIndex) {
      allLines.push({
        type: "added",
        oldLineNum: null,
        newLineNum: newIdx + 1,
        content: newLines[newIdx],
      });
      newIdx++;
    }

    // Add unchanged line (in both)
    allLines.push({
      type: "context",
      oldLineNum: oldIdx + 1,
      newLineNum: newIdx + 1,
      content: newLines[match.newIndex],
    });
    oldIdx++;
    newIdx++;
  }

  // Add remaining deleted lines
  while (oldIdx < oldLines.length) {
    allLines.push({
      type: "removed",
      oldLineNum: oldIdx + 1,
      newLineNum: null,
      content: oldLines[oldIdx],
    });
    oldIdx++;
  }

  // Add remaining added lines
  while (newIdx < newLines.length) {
    allLines.push({
      type: "added",
      oldLineNum: null,
      newLineNum: newIdx + 1,
      content: newLines[newIdx],
    });
    newIdx++;
  }

  // Return single hunk with all lines
  if (allLines.length === 0) {
    return [];
  }

  const firstLine = allLines[0];

  return [
    {
      oldStart: firstLine.oldLineNum || 1,
      oldLines: oldLines.length,
      newStart: firstLine.newLineNum || 1,
      newLines: newLines.length,
      lines: allLines,
    },
  ];
}

export function formatValue(value: unknown): string {
  if (value === undefined) return "undefined";
  if (value === null) return "null";
  if (typeof value === "bigint") return value.toString();

  try {
    return JSON.stringify(
      value,
      (_, val) => (typeof val === "bigint" ? val.toString() + "n" : val),
      2,
    );
  } catch {
    return String(value);
  }
}
