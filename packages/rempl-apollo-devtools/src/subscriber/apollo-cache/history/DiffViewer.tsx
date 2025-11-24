import React, { useMemo, useState, useRef } from "react";
import {
  VirtualizerScrollView,
  ScrollToInterface,
} from "@fluentui/react-virtualizer";
import { mergeClasses, Button, Text, tokens } from "@fluentui/react-components";
import {
  ChevronUp20Regular,
  ChevronDown20Regular,
} from "@fluentui/react-icons";
import { useDiffViewerStyles } from "./DiffViewer.styles";

interface DiffViewerProps {
  oldValue: unknown;
  newValue: unknown;
}

type DiffLine = {
  type: "context" | "added" | "removed";
  oldLineNum: number | null;
  newLineNum: number | null;
  content: string;
};

type DiffHunk = {
  oldStart: number;
  oldLines: number;
  newStart: number;
  newLines: number;
  lines: DiffLine[];
};

export const DiffViewer: React.FC<DiffViewerProps> = ({
  oldValue,
  newValue,
}) => {
  const classes = useDiffViewerStyles();
  const listRef = useRef<ScrollToInterface>(null);
  const nonVirtualizedContainerRef = useRef<HTMLDivElement>(null);
  const [currentChangeIndex, setCurrentChangeIndex] = useState(0);

  const { hunks, totalLines, changeGroups, allChangeLines } = useMemo(() => {
    const oldStr = formatValue(oldValue);
    const newStr = formatValue(newValue);
    const diffHunks = computeDiff(oldStr, newStr);

    // Calculate total lines and find change groups (consecutive changed lines = 1 change)
    let lineCount = 0;
    const groups: Array<{
      startLine: number;
      endLine: number;
      type: "added" | "removed" | "mixed";
    }> = [];
    const allChangedLines: Array<{
      lineIndex: number;
      type: "added" | "removed";
    }> = [];
    let currentGroup: {
      startLine: number;
      endLine: number;
      type: "added" | "removed" | "mixed";
    } | null = null;

    for (const hunk of diffHunks) {
      lineCount += 1; // hunk header

      for (const line of hunk.lines) {
        if (line.type !== "context") {
          allChangedLines.push({
            lineIndex: lineCount,
            type: line.type as "added" | "removed",
          });

          if (!currentGroup) {
            currentGroup = {
              startLine: lineCount,
              endLine: lineCount,
              type: line.type as "added" | "removed",
            };
          } else {
            // Extend current group
            currentGroup.endLine = lineCount;
            // If we have both added and removed, mark as mixed
            if (currentGroup.type !== line.type) {
              currentGroup.type = "mixed";
            }
          }
        } else {
          // Context line - close current group if exists
          if (currentGroup) {
            groups.push(currentGroup);
            currentGroup = null;
          }
        }
        lineCount++;
      }
    }

    // Don't forget to push the last group
    if (currentGroup) {
      groups.push(currentGroup);
    }

    return {
      hunks: diffHunks,
      totalLines: lineCount,
      changeGroups: groups,
      allChangeLines: allChangedLines,
    };
  }, [oldValue, newValue]);

  if (hunks.length === 0) {
    return (
      <div className={classes.diffContainer}>
        <div
          style={{
            padding: tokens.spacingVerticalM,
            textAlign: "center",
            color: tokens.colorNeutralForeground3,
          }}
        >
          No changes detected
        </div>
      </div>
    );
  }

  // Flatten hunks into a single array for virtualization
  const flatItems: Array<
    { type: "header"; hunk: DiffHunk } | { type: "line"; line: DiffLine }
  > = [];
  for (const hunk of hunks) {
    flatItems.push({ type: "header", hunk });
    for (const line of hunk.lines) {
      flatItems.push({ type: "line", line });
    }
  }

  const lineHeight = 20;
  const maxHeight = 600;
  const listHeight = Math.min(totalLines * lineHeight, maxHeight);

  // Enable virtualization for better performance with large diffs
  const useVirtualization = true;

  const scrollToLineIndex = (lineNumber: number) => {
    const safeLineNumber = Math.min(
      Math.max(Math.round(lineNumber), 1),
      totalLines,
    );

    if (useVirtualization) {
      listRef.current?.scrollTo(safeLineNumber, "auto");
      return;
    }

    const container = nonVirtualizedContainerRef.current;
    if (!container) return;

    const target = container.querySelector<HTMLElement>(
      `[data-line-index='${safeLineNumber}']`,
    );
    if (!target) return;

    const containerRect = container.getBoundingClientRect();
    const targetRect = target.getBoundingClientRect();
    const targetOffset =
      targetRect.top - containerRect.top + container.scrollTop;
    const centeredOffset =
      targetOffset - container.clientHeight / 2 + targetRect.height / 2;

    container.scrollTo({
      top: Math.max(centeredOffset, 0),
      behavior: "smooth",
    });
  };

  const scrollToChange = (index: number) => {
    if (index >= 0 && index < changeGroups.length) {
      setCurrentChangeIndex(index);
      const group = changeGroups[index];
      scrollToLineIndex(group.startLine);
    }
  };

  const goToNextChange = () => {
    if (currentChangeIndex < changeGroups.length - 1) {
      scrollToChange(currentChangeIndex + 1);
    }
  };

  const goToPreviousChange = () => {
    if (currentChangeIndex > 0) {
      scrollToChange(currentChangeIndex - 1);
    }
  };

  // Handle click on change map to scroll to that position
  const handleMapClick = (event: React.MouseEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const clickX = event.clientX - rect.left;
    const percentage = clickX / rect.width;
    const targetLine = Math.min(
      Math.max(Math.round(percentage * totalLines), 1),
      totalLines,
    );

    scrollToLineIndex(targetLine);

    const groupIndex = changeGroups.findIndex(
      (group) => targetLine >= group.startLine && targetLine <= group.endLine,
    );
    if (groupIndex !== -1) {
      setCurrentChangeIndex(groupIndex);
    }
  };

  // Create navigation bar
  const navigationBar = changeGroups.length > 0 && (
    <div className={classes.navigationBar}>
      <div className={classes.navigationButtons}>
        <Button
          size="small"
          appearance="subtle"
          icon={<ChevronUp20Regular />}
          onClick={goToPreviousChange}
          disabled={currentChangeIndex === 0}
        />
        <Text size={200}>
          {currentChangeIndex + 1} / {changeGroups.length}
        </Text>
        <Button
          size="small"
          appearance="subtle"
          icon={<ChevronDown20Regular />}
          onClick={goToNextChange}
          disabled={currentChangeIndex === changeGroups.length - 1}
        />
      </div>
      <div className={classes.changeMap}>
        <div className={classes.changeMapBar} onClick={handleMapClick}>
          {changeGroups.map((group, idx) => {
            const startPosition = (group.startLine / totalLines) * 100;
            const endPosition = ((group.endLine + 1) / totalLines) * 100;
            const width = Math.max(endPosition - startPosition, 0.3); // Minimum 0.3% width

            return (
              <div
                key={idx}
                className={mergeClasses(
                  classes.changeMarker,
                  group.type === "added" || group.type === "mixed"
                    ? classes.addedMarker
                    : classes.removedMarker,
                )}
                style={{
                  left: `${startPosition}%`,
                  width: `${width}%`,
                }}
              />
            );
          })}
        </div>
      </div>
    </div>
  );

  if (!useVirtualization) {
    let renderedLineIndex = 0;
    return (
      <div className={classes.diffContainer}>
        {navigationBar}
        <div
          className={classes.diffContent}
          style={{ maxHeight: `${maxHeight}px` }}
          ref={nonVirtualizedContainerRef}
        >
          {hunks.map((hunk, hunkIdx) => {
            renderedLineIndex += 1; // account for hunk header
            return (
              <div key={hunkIdx}>
                {hunk.lines.map((line, lineIdx) => {
                  const lineIndex = renderedLineIndex;
                  renderedLineIndex += 1;
                  return (
                    <DiffLineComponent
                      key={lineIdx}
                      line={line}
                      classes={classes}
                      lineIndex={lineIndex}
                    />
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className={classes.diffContainer}>
      {navigationBar}
      <VirtualizerScrollView
        imperativeRef={listRef}
        numItems={flatItems.length}
        itemSize={lineHeight}
        container={{
          style: { height: listHeight, width: "100%", overflowY: "auto" },
        }}
      >
        {(index) => {
          const item = flatItems[index];

          if (item.type === "header") {
            return <div style={{ height: lineHeight }} />;
          }

          return (
            <div style={{ height: lineHeight }}>
              <DiffLineComponent line={item.line} classes={classes} />
            </div>
          );
        }}
      </VirtualizerScrollView>
    </div>
  );
};

// Helper component to render a single diff line
interface DiffLineComponentProps {
  line: DiffLine;
  classes: ReturnType<typeof useDiffViewerStyles>;
  lineIndex?: number;
}

const DiffLineComponent: React.FC<DiffLineComponentProps> = ({
  line,
  classes,
  lineIndex,
}) => {
  return (
    <div
      className={mergeClasses(
        classes.diffLine,
        line.type === "context" && classes.lineContext,
        line.type === "added" && classes.lineAdded,
        line.type === "removed" && classes.lineRemoved,
      )}
      data-line-index={lineIndex}
    >
      <span className={classes.lineNumber}>
        {line.oldLineNum !== null ? line.oldLineNum : ""}
      </span>
      <span className={classes.lineNumber}>
        {line.newLineNum !== null ? line.newLineNum : ""}
      </span>
      <span className={classes.lineContent}>
        {line.type === "added" && (
          <span className={classes.lineAddedMarker}>+ </span>
        )}
        {line.type === "removed" && (
          <span className={classes.lineRemovedMarker}>- </span>
        )}
        {line.type === "context" && "  "}
        {line.content}
      </span>
    </div>
  );
};

function formatValue(value: unknown): string {
  if (value === undefined) return "undefined";
  if (value === null) return "null";
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

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
function computeDiff(oldText: string, newText: string): DiffHunk[] {
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
