import React, { useState, useRef } from "react";
import {
  makeStyles,
  shorthands,
  tokens,
  Text,
  Switch,
  Tooltip,
} from "@fluentui/react-components";
import { ArrowDown20Regular } from "@fluentui/react-icons";
import type { ListItemChange } from "../../../history/types";

const useStyles = makeStyles({
  container: {
    display: "flex",
    flexDirection: "column",
    ...shorthands.gap(tokens.spacingVerticalS),
  },
  summaryRow: {
    display: "flex",
    alignItems: "center",
    ...shorthands.gap(tokens.spacingHorizontalM),
  },
  summary: {
    fontSize: tokens.fontSizeBase200,
    color: tokens.colorNeutralForeground3,
  },
  listItemsContainer: {
    display: "flex",
    flexDirection: "column",
    ...shorthands.gap(tokens.spacingVerticalXS),
  },
  listItem: {
    ...shorthands.padding(tokens.spacingVerticalXS, tokens.spacingHorizontalS),
    backgroundColor: tokens.colorNeutralBackground2,
    ...shorthands.borderRadius(tokens.borderRadiusSmall),
    fontSize: tokens.fontSizeBase200,
  },
  listItemText: {
    fontFamily: tokens.fontFamilyBase,
  },
  // Visual diff styles
  visualContainer: {
    display: "flex",
    flexDirection: "column",
    ...shorthands.gap(tokens.spacingVerticalS),
    position: "relative",
    ...shorthands.overflow("visible"),
  },
  indexRow: {
    display: "flex",
    flexDirection: "column",
    ...shorthands.gap(tokens.spacingVerticalXS),
    ...shorthands.overflow("visible"),
  },
  rowLabel: {
    fontWeight: tokens.fontWeightSemibold,
    fontSize: tokens.fontSizeBase300,
    color: tokens.colorNeutralForeground2,
    marginBottom: tokens.spacingVerticalXS,
  },
  scrollableContainer: {
    position: "relative",
    ...shorthands.overflow("visible"),
    overflowX: "auto",
    overflowY: "visible",
    ...shorthands.borderRadius(tokens.borderRadiusSmall),
    backgroundColor: tokens.colorNeutralBackground1,
    ...shorthands.padding(tokens.spacingVerticalS),
  },
  indexBoxesContainer: {
    display: "flex",
    flexWrap: "nowrap",
    ...shorthands.gap(tokens.spacingHorizontalM),
    alignItems: "flex-start",
    minHeight: "120px",
  },
  indexBox: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    ...shorthands.gap(tokens.spacingVerticalXXS),
    minWidth: "180px",
    flexShrink: 0,
    position: "relative",
    cursor: "pointer",
    ...shorthands.margin(0, tokens.spacingHorizontalXS),
  },
  indexBoxUnchanged: {
    minWidth: "80px",
    cursor: "default",
  },
  ellipsisIndicator: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    minWidth: "60px",
    flexShrink: 0,
    ...shorthands.margin(0, tokens.spacingHorizontalXS),
    fontSize: tokens.fontSizeBase400,
    color: tokens.colorNeutralForeground3,
    fontWeight: tokens.fontWeightSemibold,
  },
  noteIndicator: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    minWidth: "150px",
    flexShrink: 0,
    ...shorthands.margin(0, tokens.spacingHorizontalXS),
    fontSize: tokens.fontSizeBase200,
    color: tokens.colorNeutralForeground4,
    fontStyle: "italic",
    ...shorthands.padding(tokens.spacingVerticalS),
    cursor: "help",
    textDecorationLine: "underline",
    textDecorationStyle: "dotted",
  },
  indexLabel: {
    fontSize: tokens.fontSizeBase100,
    fontWeight: tokens.fontWeightSemibold,
    color: tokens.colorNeutralForeground3,
    ...shorthands.padding(
      tokens.spacingVerticalXXS,
      tokens.spacingHorizontalXS,
    ),
    display: "flex",
    alignItems: "center",
    ...shorthands.gap(tokens.spacingHorizontalXXS),
    justifyContent: "center",
  },
  indexContent: {
    ...shorthands.padding(tokens.spacingVerticalS, tokens.spacingHorizontalS),
    ...shorthands.borderRadius(tokens.borderRadiusSmall),
    ...shorthands.border(
      tokens.strokeWidthThin,
      "solid",
      tokens.colorNeutralStroke2,
    ),
    fontSize: tokens.fontSizeBase200,
    fontFamily: tokens.fontFamilyMonospace,
    textAlign: "left",
    minHeight: "32px",
    width: "100%",
    ...shorthands.overflow("hidden"),
    ...shorthands.transition("all", "0.2s"),
    "&:hover": {
      transform: "translateY(-2px)",
      boxShadow: tokens.shadow4,
    },
  },
  indexContentExpanded: {
    textAlign: "left",
    whiteSpace: "pre",
    maxHeight: "400px",
    width: "max-content",
    maxWidth: "600px",
    ...shorthands.overflow("auto"),
    fontSize: tokens.fontSizeBase300,
    lineHeight: tokens.lineHeightBase300,
  },
  indexContentCollapsed: {
    textAlign: "center",
    whiteSpace: "nowrap",
    textOverflow: "ellipsis",
    width: "100%",
    display: "-webkit-box",
    WebkitLineClamp: "2",
    WebkitBoxOrient: "vertical",
    ...shorthands.overflow("hidden"),
  },
  // States for index boxes
  unchanged: {
    backgroundColor: tokens.colorNeutralBackground3,
    ...shorthands.borderColor(tokens.colorNeutralStroke2),
    opacity: 0.7,
  },
  removed: {
    backgroundColor: "rgba(196, 49, 75, 0.1)",
    ...shorthands.borderColor(tokens.colorPaletteRedBorder1),
  },
  added: {
    backgroundColor: "rgba(16, 124, 16, 0.1)",
    ...shorthands.borderColor(tokens.colorPaletteGreenBorder1),
  },
  moved: {
    backgroundColor: "rgba(0, 120, 212, 0.1)",
    ...shorthands.borderColor(tokens.colorBrandStroke1),
    cursor: "pointer",
  },
  stateLabel: {
    fontSize: "9px",
    fontWeight: tokens.fontWeightSemibold,
    ...shorthands.padding("1px", "4px"),
    ...shorthands.borderRadius(tokens.borderRadiusSmall),
    textTransform: "uppercase",
    letterSpacing: "0.3px",
    lineHeight: "12px",
  },
  labelRemoved: {
    color: tokens.colorPaletteRedForeground1,
    backgroundColor: "rgba(196, 49, 75, 0.2)",
  },
  labelAdded: {
    color: tokens.colorPaletteGreenForeground1,
    backgroundColor: "rgba(16, 124, 16, 0.2)",
  },
  labelMoved: {
    color: tokens.colorBrandForeground1,
    backgroundColor: "rgba(0, 120, 212, 0.2)",
  },
  arrow: {
    color: tokens.colorBrandForeground1,
    fontSize: "20px",
  },
  hoverInfo: {
    position: "absolute",
    bottom: "-20px",
    left: "50%",
    transform: "translateX(-50%)",
    fontSize: tokens.fontSizeBase100,
    color: tokens.colorBrandForeground1,
    whiteSpace: "nowrap",
    fontWeight: tokens.fontWeightSemibold,
  },
  svgArrowContainer: {
    position: "absolute",
    top: 0,
    left: 0,
    width: "100%",
    height: "100%",
    pointerEvents: "none",
    zIndex: 5,
  },
});

interface ArrayDiffViewerProps {
  itemChanges: ListItemChange[];
  oldValue?: unknown[];
  newValue?: unknown[];
}

// Helper to build index mapping
interface IndexMapping {
  oldIndex: number | null; // null means added
  newIndex: number | null; // null means removed
  state: "unchanged" | "added" | "removed" | "moved";
  data?: unknown;
}

export const ArrayDiffViewer: React.FC<ArrayDiffViewerProps> = ({
  itemChanges,
  oldValue,
  newValue,
}) => {
  const classes = useStyles();
  const [showVisual, setShowVisual] = useState(true);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [expandedOldIndex, setExpandedOldIndex] = useState<number | null>(null);
  const [expandedNewIndex, setExpandedNewIndex] = useState<number | null>(null);
  const oldContainerRef = useRef<HTMLDivElement>(null);
  const newContainerRef = useRef<HTMLDivElement>(null);

  const formatValueForDisplay = (value: unknown): string => {
    if (value === undefined) return "undefined";
    if (value === null) return "null";
    try {
      return JSON.stringify(value, null, 2);
    } catch {
      return String(value);
    }
  };

  const formatDataPreview = (data: unknown): string => {
    if (data === null) return "null";
    if (data === undefined) return "undefined";
    if (typeof data === "string") {
      return data.length > 15 ? `"${data.slice(0, 15)}..."` : `"${data}"`;
    }
    if (typeof data === "object") {
      try {
        const str = JSON.stringify(data);
        return str.length > 15 ? str.slice(0, 15) + "..." : str;
      } catch {
        return String(data);
      }
    }
    return String(data);
  };

  const getSummary = () => {
    const stats = { added: 0, removed: 0, moved: 0, updated: 0 };
    itemChanges.forEach((change) => {
      switch (change.kind) {
        case "ItemAdd":
          stats.added++;
          break;
        case "ItemRemove":
          stats.removed++;
          break;
        case "ItemIndexChange":
          // Only count as "moved" if the index change is significant (not just a +/-1 shift)
          // This filters out items that just shifted due to insertions/deletions
          if (change.index !== undefined && change.oldIndex !== undefined) {
            const indexDiff = Math.abs(change.index - change.oldIndex);
            if (indexDiff > 1) {
              stats.moved++;
            }
          }
          break;
        case "ItemUpdate":
          stats.updated++;
          break;
      }
    });
    const parts: string[] = [];
    if (stats.added > 0) parts.push(`${stats.added} added`);
    if (stats.removed > 0) parts.push(`${stats.removed} removed`);
    if (stats.moved > 0) parts.push(`${stats.moved} moved`);
    if (stats.updated > 0) parts.push(`${stats.updated} updated`);
    return parts.join(", ");
  };

  const getListItemChangeDescription = (change: ListItemChange): string => {
    switch (change.kind) {
      case "ItemAdd":
        return `Item added at index ${change.index}`;
      case "ItemRemove":
        return `Item removed from index ${change.oldIndex}`;
      case "ItemIndexChange":
        return `Item moved from index ${change.oldIndex} to ${change.index}`;
      case "ItemUpdate":
        return `Item updated at index ${change.index ?? change.oldIndex}`;
      default:
        return "Item changed";
    }
  };

  if (!showVisual) {
    return (
      <div className={classes.container}>
        <div className={classes.summaryRow}>
          <Text className={classes.summary}>{getSummary()}</Text>
          <Switch
            label="Show visual diff"
            checked={showVisual}
            onChange={(_, data) => setShowVisual(data.checked)}
          />
        </div>
        <div className={classes.listItemsContainer}>
          {itemChanges.map((change, index) => (
            <div key={index} className={classes.listItem}>
              <Text className={classes.listItemText}>
                {getListItemChangeDescription(change)}
              </Text>
              {change.data !== undefined && (
                <pre
                  style={{
                    margin: "4px 0 0 0",
                    fontSize: "12px",
                    fontFamily: tokens.fontFamilyMonospace,
                  }}
                >
                  {formatValueForDisplay(change.data)}
                </pre>
              )}
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Build index mappings for visual view
  // We need to figure out the maximum index in both old and new arrays
  const maxOldIndex = Math.max(
    ...(oldValue ? [oldValue.length - 1] : []),
    ...itemChanges
      .filter((c) => c.oldIndex !== undefined)
      .map((c) => c.oldIndex!),
    -1,
  );

  const maxNewIndex = Math.max(
    ...(newValue ? [newValue.length - 1] : []),
    ...itemChanges.filter((c) => c.index !== undefined).map((c) => c.index!),
    -1,
  );

  // For additions, we know items before that index existed in old array
  // For example, if item added at index 3, indices 0,1,2 must have existed
  itemChanges.forEach((change) => {
    if (change.kind === "ItemAdd" && change.index !== undefined) {
      // All indices before this one must have existed in old array
      for (let i = 0; i < change.index; i++) {
        if (maxOldIndex < i) {
          // Extend maxOldIndex to include these implicit unchanged items
          // This is handled by the loop below
        }
      }
    }
  });

  // Determine the true maximum old index considering implicit unchanged items
  const implicitMaxOldIndex = Math.max(
    maxOldIndex,
    ...itemChanges
      .filter((c) => c.kind === "ItemAdd" && c.index !== undefined)
      .map((c) => c.index! - 1),
    -1,
  );

  // Create a map to track all index transformations
  const indexMap = new Map<number, IndexMapping>();

  // Initialize with all possible old indices
  for (let i = 0; i <= implicitMaxOldIndex; i++) {
    indexMap.set(i, {
      oldIndex: i,
      newIndex: i, // Assume same position initially
      state: "unchanged",
      data: oldValue?.[i] ?? newValue?.[i],
    });
  }

  // Track which new indices are handled
  const handledNewIndices = new Set<number>();

  // Apply changes to update the mappings
  itemChanges.forEach((change) => {
    switch (change.kind) {
      case "ItemRemove":
        if (change.oldIndex !== undefined) {
          const mapping = indexMap.get(change.oldIndex) || {
            oldIndex: change.oldIndex,
            newIndex: null,
            state: "removed" as const,
            data: change.data ?? oldValue?.[change.oldIndex],
          };
          mapping.state = "removed";
          mapping.newIndex = null;
          mapping.data = change.data ?? oldValue?.[change.oldIndex];
          indexMap.set(change.oldIndex, mapping);
        }
        break;

      case "ItemAdd":
        if (change.index !== undefined) {
          handledNewIndices.add(change.index);

          // Find if there's already a mapping for this position
          let foundExisting = false;
          for (const [key, mapping] of indexMap.entries()) {
            if (
              mapping.newIndex === change.index &&
              mapping.state === "unchanged"
            ) {
              // This was an unchanged item, but now it's being pushed aside by an addition
              // Don't modify it, the addition is separate
              foundExisting = false;
              break;
            }
          }

          // Create a new entry for this addition (no old index)
          const newKey = implicitMaxOldIndex + 1 + change.index;
          indexMap.set(newKey, {
            oldIndex: null,
            newIndex: change.index,
            state: "added",
            data: change.data ?? newValue?.[change.index],
          });
        }
        break;

      case "ItemIndexChange":
        if (change.oldIndex !== undefined && change.index !== undefined) {
          handledNewIndices.add(change.index);
          const mapping = indexMap.get(change.oldIndex) || {
            oldIndex: change.oldIndex,
            newIndex: change.index,
            state: "moved" as const,
            data: change.data ?? newValue?.[change.index],
          };
          mapping.newIndex = change.index;
          mapping.state = "moved";
          mapping.data = change.data ?? newValue?.[change.index];
          indexMap.set(change.oldIndex, mapping);
        }
        break;

      case "ItemUpdate":
        if (change.index !== undefined || change.oldIndex !== undefined) {
          const idx = change.index ?? change.oldIndex!;
          handledNewIndices.add(idx);
          const mapping = indexMap.get(idx) || {
            oldIndex: idx,
            newIndex: idx,
            state: "unchanged" as const,
            data: change.data ?? newValue?.[idx],
          };
          mapping.data = change.data ?? newValue?.[idx];
          indexMap.set(idx, mapping);
        }
        break;
    }
  });

  // Convert map to sorted array
  const mappings = Array.from(indexMap.values()).filter(
    (m) => m.oldIndex !== null || m.newIndex !== null,
  );

  // Sort by old index first, then by new index
  mappings.sort((a, b) => {
    if (a.oldIndex !== null && b.oldIndex !== null) {
      return a.oldIndex - b.oldIndex;
    }
    if (a.oldIndex !== null) return -1;
    if (b.oldIndex !== null) return 1;
    if (a.newIndex !== null && b.newIndex !== null) {
      return a.newIndex - b.newIndex;
    }
    return 0;
  });

  // Helper to add ellipsis between non-consecutive unchanged indices
  const addEllipsisToList = (
    items: IndexMapping[],
    indexKey: "oldIndex" | "newIndex",
  ) => {
    const result: (
      | IndexMapping
      | { type: "ellipsis"; beforeIndex: number }
      | { type: "note" }
    )[] = [];
    let lastIndex = -1;

    items.forEach((item) => {
      const currentIndex = item[indexKey];
      if (currentIndex !== null) {
        // Check if there's a gap and previous/current are unchanged
        if (lastIndex !== -1 && currentIndex - lastIndex > 1) {
          const prevItem = result[result.length - 1];
          if (
            prevItem &&
            "state" in prevItem &&
            prevItem.state === "unchanged" &&
            item.state === "unchanged"
          ) {
            result.push({ type: "ellipsis", beforeIndex: currentIndex });
          }
        }
        result.push(item);
        lastIndex = currentIndex;
      }
    });

    // Always add a note at the end to indicate there may be more items
    if (result.length > 0) {
      result.push({ type: "note" });
    }

    return result;
  };

  return (
    <div className={classes.container}>
      <div className={classes.summaryRow}>
        <Text className={classes.summary}>{getSummary()}</Text>
        <Switch
          label="Show visual diff"
          checked={showVisual}
          onChange={(_, data) => setShowVisual(data.checked)}
        />
      </div>

      <div className={classes.visualContainer}>
        {/* Old indices row */}
        <div className={classes.indexRow}>
          <Text className={classes.rowLabel}>Old Array (Before):</Text>
          <div className={classes.scrollableContainer} ref={oldContainerRef}>
            <div className={classes.indexBoxesContainer}>
              {addEllipsisToList(
                mappings.filter((m) => m.oldIndex !== null),
                "oldIndex",
              ).map((item, idx) => {
                if ("type" in item && item.type === "ellipsis") {
                  return (
                    <div
                      key={`ellipsis-old-${idx}`}
                      className={classes.ellipsisIndicator}
                    >
                      ⋯
                    </div>
                  );
                }

                if ("type" in item && item.type === "note") {
                  return (
                    <Tooltip
                      key={`note-old-${idx}`}
                      content="Only changed items are reported. The actual array may contain additional unchanged items beyond the last displayed index."
                      relationship="description"
                    >
                      <div className={classes.noteIndicator}>
                        (may have more)
                      </div>
                    </Tooltip>
                  );
                }

                const mapping = item as IndexMapping;
                const hasData = mapping.data !== undefined;
                const isExpanded = expandedOldIndex === mapping.oldIndex;
                const isUnchanged = mapping.state === "unchanged";

                return (
                  <div
                    key={`old-${idx}`}
                    className={`${classes.indexBox} ${
                      isUnchanged ? classes.indexBoxUnchanged : ""
                    }`}
                    onMouseEnter={() =>
                      !isUnchanged &&
                      mapping.state === "moved" &&
                      setHoveredIndex(mapping.oldIndex)
                    }
                    onMouseLeave={() => setHoveredIndex(null)}
                    onClick={() => {
                      if (hasData) {
                        setExpandedOldIndex(
                          isExpanded ? null : mapping.oldIndex,
                        );
                      }
                    }}
                    style={{ cursor: hasData ? "pointer" : "default" }}
                  >
                    <div className={classes.indexLabel}>
                      <Text>[{mapping.oldIndex}]</Text>
                      {!isUnchanged && (
                        <Text
                          className={`${classes.stateLabel} ${
                            mapping.state === "removed"
                              ? classes.labelRemoved
                              : mapping.state === "moved"
                              ? classes.labelMoved
                              : ""
                          }`}
                        >
                          {mapping.state === "removed" ? "removed" : "moved"}
                        </Text>
                      )}
                    </div>
                    <div
                      className={`${classes.indexContent} ${
                        isExpanded
                          ? classes.indexContentExpanded
                          : classes.indexContentCollapsed
                      } ${
                        mapping.state === "unchanged"
                          ? classes.unchanged
                          : mapping.state === "removed"
                          ? classes.removed
                          : mapping.state === "moved"
                          ? classes.moved
                          : ""
                      }`}
                    >
                      {isExpanded
                        ? formatValueForDisplay(mapping.data)
                        : mapping.state === "unchanged" &&
                          mapping.data === undefined
                        ? "unchanged"
                        : formatDataPreview(mapping.data)}
                    </div>
                    {!isUnchanged &&
                      hoveredIndex === mapping.oldIndex &&
                      mapping.state === "moved" &&
                      mapping.newIndex !== null && (
                        <Text className={classes.hoverInfo}>
                          → moves to [{mapping.newIndex}]
                        </Text>
                      )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Arrows for moved items */}
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            color: tokens.colorNeutralForeground3,
          }}
        >
          <ArrowDown20Regular className={classes.arrow} />
        </div>

        {/* New indices row */}
        <div className={classes.indexRow}>
          <Text className={classes.rowLabel}>New Array (After):</Text>
          <div className={classes.scrollableContainer} ref={newContainerRef}>
            <div className={classes.indexBoxesContainer}>
              {addEllipsisToList(
                mappings
                  .filter((m) => m.newIndex !== null)
                  .sort((a, b) => a.newIndex! - b.newIndex!),
                "newIndex",
              ).map((item, idx) => {
                if ("type" in item && item.type === "ellipsis") {
                  return (
                    <div
                      key={`ellipsis-new-${idx}`}
                      className={classes.ellipsisIndicator}
                    >
                      ⋯
                    </div>
                  );
                }

                if ("type" in item && item.type === "note") {
                  return (
                    <Tooltip
                      key={`note-new-${idx}`}
                      content="Only changed items are reported. The actual array may contain additional unchanged items beyond the last displayed index."
                      relationship="description"
                    >
                      <div className={classes.noteIndicator}>
                        (may have more)
                      </div>
                    </Tooltip>
                  );
                }

                const mapping = item as IndexMapping;
                const hasData = mapping.data !== undefined;
                const isExpanded = expandedNewIndex === mapping.newIndex;
                const isUnchanged = mapping.state === "unchanged";

                return (
                  <div
                    key={`new-${idx}`}
                    className={`${classes.indexBox} ${
                      isUnchanged ? classes.indexBoxUnchanged : ""
                    }`}
                    onMouseEnter={() =>
                      !isUnchanged &&
                      mapping.state === "moved" &&
                      setHoveredIndex(mapping.oldIndex)
                    }
                    onMouseLeave={() => setHoveredIndex(null)}
                    onClick={() => {
                      if (hasData) {
                        setExpandedNewIndex(
                          isExpanded ? null : mapping.newIndex,
                        );
                      }
                    }}
                    style={{ cursor: hasData ? "pointer" : "default" }}
                  >
                    <div className={classes.indexLabel}>
                      <Text>[{mapping.newIndex}]</Text>
                      {!isUnchanged && (
                        <Text
                          className={`${classes.stateLabel} ${
                            mapping.state === "added"
                              ? classes.labelAdded
                              : mapping.state === "moved"
                              ? classes.labelMoved
                              : ""
                          }`}
                        >
                          {mapping.state === "added" ? "added" : "moved"}
                        </Text>
                      )}
                    </div>
                    <div
                      className={`${classes.indexContent} ${
                        isExpanded
                          ? classes.indexContentExpanded
                          : classes.indexContentCollapsed
                      } ${
                        mapping.state === "unchanged"
                          ? classes.unchanged
                          : mapping.state === "added"
                          ? classes.added
                          : mapping.state === "moved"
                          ? classes.moved
                          : ""
                      }`}
                    >
                      {isExpanded
                        ? formatValueForDisplay(mapping.data)
                        : mapping.state === "unchanged" &&
                          mapping.data === undefined
                        ? "unchanged"
                        : formatDataPreview(mapping.data)}
                    </div>
                    {!isUnchanged &&
                      hoveredIndex === mapping.oldIndex &&
                      mapping.state === "moved" &&
                      mapping.oldIndex !== null && (
                        <Text className={classes.hoverInfo}>
                          ← from [{mapping.oldIndex}]
                        </Text>
                      )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
