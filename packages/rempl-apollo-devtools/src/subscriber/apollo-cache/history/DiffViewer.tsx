import React, { useMemo, useState, useRef } from "react";
import { FixedSizeList as List } from "react-window";
import {
  makeStyles,
  shorthands,
  tokens,
  mergeClasses,
  Button,
  Text,
} from "@fluentui/react-components";
import {
  ChevronUp20Regular,
  ChevronDown20Regular,
} from "@fluentui/react-icons";

const useStyles = makeStyles({
  diffContainer: {
    ...shorthands.border(
      tokens.strokeWidthThin,
      "solid",
      tokens.colorNeutralStroke2,
    ),
    ...shorthands.borderRadius(tokens.borderRadiusMedium),
    ...shorthands.overflow("hidden"),
    backgroundColor: tokens.colorNeutralBackground1,
    fontFamily: tokens.fontFamilyMonospace,
    fontSize: tokens.fontSizeBase200,
  },
  diffContent: {
    maxHeight: "600px",
    ...shorthands.overflow("auto"),
    overflowX: "auto",
    overflowY: "auto",
  },
  diffLine: {
    display: "grid",
    gridTemplateColumns: "40px 40px 1fr",
    minHeight: "20px",
    lineHeight: "20px",
    ...shorthands.padding(0, tokens.spacingHorizontalS),
    whiteSpace: "pre",
    fontFamily: tokens.fontFamilyMonospace,
    fontSize: tokens.fontSizeBase200,
  },
  lineNumber: {
    color: tokens.colorNeutralForeground3,
    textAlign: "right",
    userSelect: "none",
    paddingRight: tokens.spacingHorizontalXS,
  },
  lineContent: {
    whiteSpace: "pre",
    overflowX: "auto",
  },
  lineContext: {
    backgroundColor: tokens.colorNeutralBackground1,
  },
  lineAdded: {
    backgroundColor: "rgba(46, 160, 67, 0.15)",
    color: tokens.colorNeutralForeground1,
  },
  lineAddedMarker: {
    color: tokens.colorPaletteGreenForeground1,
  },
  lineRemoved: {
    backgroundColor: "rgba(248, 81, 73, 0.15)",
    color: tokens.colorNeutralForeground1,
  },
  lineRemovedMarker: {
    color: tokens.colorPaletteRedForeground1,
  },
  hunkHeader: {
    backgroundColor: tokens.colorNeutralBackground2,
    color: tokens.colorBrandForeground1,
    ...shorthands.padding(tokens.spacingVerticalXS, tokens.spacingHorizontalS),
    fontWeight: tokens.fontWeightSemibold,
    ...shorthands.borderTop(
      tokens.strokeWidthThin,
      "solid",
      tokens.colorNeutralStroke2,
    ),
    ...shorthands.borderBottom(
      tokens.strokeWidthThin,
      "solid",
      tokens.colorNeutralStroke2,
    ),
  },
  navigationBar: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    ...shorthands.padding(tokens.spacingVerticalS, tokens.spacingHorizontalM),
    backgroundColor: tokens.colorNeutralBackground2,
    ...shorthands.borderBottom(
      tokens.strokeWidthThin,
      "solid",
      tokens.colorNeutralStroke2,
    ),
    position: "sticky",
    top: 0,
    zIndex: 10,
  },
  navigationButtons: {
    display: "flex",
    ...shorthands.gap(tokens.spacingHorizontalXS),
    alignItems: "center",
  },
  changeMap: {
    display: "flex",
    alignItems: "center",
    ...shorthands.gap(tokens.spacingHorizontalS),
    ...shorthands.flex(1),
    maxWidth: "400px",
    marginLeft: tokens.spacingHorizontalM,
  },
  changeMapBar: {
    ...shorthands.flex(1),
    height: "20px",
    backgroundColor: tokens.colorNeutralBackground3,
    ...shorthands.borderRadius(tokens.borderRadiusSmall),
    position: "relative",
    ...shorthands.border(
      tokens.strokeWidthThin,
      "solid",
      tokens.colorNeutralStroke2,
    ),
    ...shorthands.overflow("hidden"),
    cursor: "pointer",
    "&:hover": {
      backgroundColor: tokens.colorNeutralBackground3Hover,
    },
  },
  changeMarker: {
    position: "absolute",
    width: "3px",
    height: "100%",
    top: 0,
  },
  addedMarker: {
    backgroundColor: tokens.colorPaletteGreenForeground1,
  },
  removedMarker: {
    backgroundColor: tokens.colorPaletteRedForeground1,
  },
});

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
  const classes = useStyles();
  const listRef = useRef<List>(null);
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

  const scrollToChange = (index: number) => {
    if (index >= 0 && index < changeGroups.length) {
      setCurrentChangeIndex(index);
      const group = changeGroups[index];
      listRef.current?.scrollToItem(group.startLine, "center");
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

  // Use virtualization only if we have many lines
  const useVirtualization = totalLines > 30;

  // Handle click on change map to scroll to that position
  const handleMapClick = (event: React.MouseEvent<HTMLDivElement>) => {
    if (!listRef.current) return;

    const rect = event.currentTarget.getBoundingClientRect();
    const clickX = event.clientX - rect.left;
    const percentage = clickX / rect.width;
    const targetLine = Math.floor(percentage * totalLines);

    // Scroll directly to the clicked position
    listRef.current.scrollToItem(targetLine, "center");
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
          {allChangeLines.map((change, idx) => {
            const position = (change.lineIndex / totalLines) * 100;

            return (
              <div
                key={idx}
                className={mergeClasses(
                  classes.changeMarker,
                  change.type === "added"
                    ? classes.addedMarker
                    : classes.removedMarker,
                )}
                style={{ left: `${position}%` }}
              />
            );
          })}
        </div>
      </div>
    </div>
  );

  if (!useVirtualization) {
    return (
      <div className={classes.diffContainer}>
        {navigationBar}
        <div
          className={classes.diffContent}
          style={{ maxHeight: `${maxHeight}px` }}
        >
          {hunks.map((hunk, hunkIdx) => (
            <div key={hunkIdx}>
              {hunk.lines.map((line, lineIdx) => (
                <DiffLineComponent
                  key={lineIdx}
                  line={line}
                  classes={classes}
                />
              ))}
            </div>
          ))}
        </div>
      </div>
    );
  }

  const Row = ({
    index,
    style,
  }: {
    index: number;
    style: React.CSSProperties;
  }) => {
    const item = flatItems[index];

    if (item.type === "header") {
      return null; // Skip hunk headers in virtualized view
    }

    return (
      <div style={style}>
        <DiffLineComponent line={item.line} classes={classes} />
      </div>
    );
  };

  return (
    <div className={classes.diffContainer}>
      {navigationBar}
      <List
        ref={listRef}
        height={listHeight}
        itemCount={flatItems.length}
        itemSize={lineHeight}
        width="100%"
      >
        {Row}
      </List>
    </div>
  );
};

// Helper component to render a single diff line
interface DiffLineComponentProps {
  line: DiffLine;
  classes: ReturnType<typeof useStyles>;
}

const DiffLineComponent: React.FC<DiffLineComponentProps> = ({
  line,
  classes,
}) => {
  return (
    <div
      className={mergeClasses(
        classes.diffLine,
        line.type === "context" && classes.lineContext,
        line.type === "added" && classes.lineAdded,
        line.type === "removed" && classes.lineRemoved,
      )}
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

// Simple diff algorithm - shows ALL lines with changes highlighted
function computeDiff(oldText: string, newText: string): DiffHunk[] {
  const oldLines = oldText.split("\n");
  const newLines = newText.split("\n");

  // Build a single hunk with ALL lines
  const allLines: DiffLine[] = [];
  let oldIdx = 0;
  let newIdx = 0;

  while (oldIdx < oldLines.length || newIdx < newLines.length) {
    if (oldIdx >= oldLines.length) {
      // Rest are additions
      allLines.push({
        type: "added",
        oldLineNum: null,
        newLineNum: newIdx + 1,
        content: newLines[newIdx],
      });
      newIdx++;
    } else if (newIdx >= newLines.length) {
      // Rest are deletions
      allLines.push({
        type: "removed",
        oldLineNum: oldIdx + 1,
        newLineNum: null,
        content: oldLines[oldIdx],
      });
      oldIdx++;
    } else if (oldLines[oldIdx] === newLines[newIdx]) {
      // Lines match - context (show all context lines)
      allLines.push({
        type: "context",
        oldLineNum: oldIdx + 1,
        newLineNum: newIdx + 1,
        content: oldLines[oldIdx],
      });
      oldIdx++;
      newIdx++;
    } else {
      // Lines differ - try to find best match
      const oldLine = oldLines[oldIdx];
      const newLine = newLines[newIdx];

      // Look ahead to see if we can find a match
      let foundMatch = false;
      const lookAhead = 5;

      for (let i = 1; i <= lookAhead && !foundMatch; i++) {
        if (oldIdx + i < oldLines.length && oldLines[oldIdx + i] === newLine) {
          // Found match in old - lines were removed
          allLines.push({
            type: "removed",
            oldLineNum: oldIdx + 1,
            newLineNum: null,
            content: oldLines[oldIdx],
          });
          oldIdx++;
          foundMatch = true;
        } else if (
          newIdx + i < newLines.length &&
          newLines[newIdx + i] === oldLine
        ) {
          // Found match in new - lines were added
          allLines.push({
            type: "added",
            oldLineNum: null,
            newLineNum: newIdx + 1,
            content: newLines[newIdx],
          });
          newIdx++;
          foundMatch = true;
        }
      }

      if (!foundMatch) {
        // No match found - treat as replacement
        allLines.push({
          type: "removed",
          oldLineNum: oldIdx + 1,
          newLineNum: null,
          content: oldLines[oldIdx],
        });
        allLines.push({
          type: "added",
          oldLineNum: null,
          newLineNum: newIdx + 1,
          content: newLines[newIdx],
        });
        oldIdx++;
        newIdx++;
      }
    }
  }

  // Return single hunk with all lines
  if (allLines.length === 0) {
    return [];
  }

  const firstLine = allLines[0];
  const lastLine = allLines[allLines.length - 1];

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
