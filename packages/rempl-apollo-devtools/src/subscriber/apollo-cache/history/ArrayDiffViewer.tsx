import React, { useState, useRef } from "react";
import {
  makeStyles,
  shorthands,
  tokens,
  Text,
  Switch,
  Button,
} from "@fluentui/react-components";
import { ArrowDown20Regular, Navigation20Regular } from "@fluentui/react-icons";
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
  visualContainer: {
    display: "flex",
    flexDirection: "column",
    ...shorthands.gap(tokens.spacingVerticalS),
  },
  indexRow: {
    display: "flex",
    flexDirection: "column",
    ...shorthands.gap(tokens.spacingVerticalXS),
  },
  rowLabel: {
    fontWeight: tokens.fontWeightSemibold,
    fontSize: tokens.fontSizeBase300,
    color: tokens.colorNeutralForeground2,
    marginBottom: tokens.spacingVerticalXS,
  },
  scrollableContainer: {
    overflowX: "auto",
    ...shorthands.borderRadius(tokens.borderRadiusSmall),
    backgroundColor: tokens.colorNeutralBackground1,
    ...shorthands.padding(tokens.spacingVerticalS),
  },
  indexBoxesContainer: {
    display: "flex",
    flexWrap: "nowrap",
    ...shorthands.gap(tokens.spacingHorizontalM),
    alignItems: "flex-start",
    minHeight: "100px",
  },
  indexBox: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    ...shorthands.gap(tokens.spacingVerticalXXS),
    minWidth: "180px",
    flexShrink: 0,
    cursor: "pointer",
    position: "relative",
    ...shorthands.margin(0, tokens.spacingHorizontalXS),
  },
  ellipsisIndicator: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    minWidth: "40px",
    flexShrink: 0,
    fontSize: tokens.fontSizeBase500,
    color: tokens.colorNeutralForeground3,
    fontWeight: tokens.fontWeightSemibold,
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
  },
  indexContentCollapsed: {
    textAlign: "center",
    whiteSpace: "nowrap",
    textOverflow: "ellipsis",
    display: "-webkit-box",
    WebkitLineClamp: "2",
    WebkitBoxOrient: "vertical",
    ...shorthands.overflow("hidden"),
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
  },
  movedHovered: {
    backgroundColor: "rgba(0, 120, 212, 0.25)",
    ...shorthands.borderColor(tokens.colorBrandStroke1),
    boxShadow: tokens.shadow8,
    transform: "scale(1.02)",
  },
  updated: {
    backgroundColor: "rgba(245, 159, 0, 0.1)",
    ...shorthands.borderColor(tokens.colorPaletteYellowBorder1),
  },
  stateLabel: {
    fontSize: "9px",
    fontWeight: tokens.fontWeightSemibold,
    ...shorthands.padding("1px", "4px"),
    ...shorthands.borderRadius(tokens.borderRadiusSmall),
    textTransform: "uppercase",
    letterSpacing: "0.3px",
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
  labelUpdated: {
    color: tokens.colorPaletteYellowForeground1,
    backgroundColor: "rgba(245, 159, 0, 0.2)",
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
  navigationMap: {
    display: "flex",
    flexWrap: "wrap",
    alignItems: "center",
    ...shorthands.gap(tokens.spacingHorizontalXXS, tokens.spacingVerticalXXS),
    ...shorthands.padding(tokens.spacingVerticalS, tokens.spacingHorizontalS),
    backgroundColor: tokens.colorNeutralBackground2,
    ...shorthands.borderRadius(tokens.borderRadiusSmall),
  },
  navButton: {
    minWidth: "auto",
    ...shorthands.padding("2px", tokens.spacingHorizontalXXS),
    fontSize: tokens.fontSizeBase100,
    height: "22px",
  },
  navLabel: {
    fontSize: tokens.fontSizeBase200,
    fontWeight: tokens.fontWeightSemibold,
    color: tokens.colorNeutralForeground2,
    display: "flex",
    alignItems: "center",
    ...shorthands.gap(tokens.spacingHorizontalXXS),
  },
  noChangesMessage: {
    ...shorthands.padding(tokens.spacingVerticalL),
    textAlign: "center",
    color: tokens.colorNeutralForeground3,
    fontStyle: "italic",
  },
  disclaimerNote: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    minWidth: "150px",
    flexShrink: 0,
    fontSize: tokens.fontSizeBase100,
    color: tokens.colorNeutralForeground4,
    fontStyle: "italic",
    ...shorthands.padding(tokens.spacingVerticalXS),
    ...shorthands.margin(0, tokens.spacingHorizontalXS),
  },
});

interface ArrayDiffViewerProps {
  itemChanges: ListItemChange[];
  oldValue?: unknown[];
  newValue?: unknown[];
}

interface IndexItem {
  index: number;
  state: "added" | "removed" | "moved" | "updated";
  data?: unknown;
  oldIndex?: number; // for moved items
  newIndex?: number; // for moved items
}

export const ArrayDiffViewer: React.FC<ArrayDiffViewerProps> = ({
  itemChanges,
  oldValue,
  newValue,
}) => {
  const classes = useStyles();
  const [showVisual, setShowVisual] = useState(true);
  const [hoveredOldIndex, setHoveredOldIndex] = useState<number | null>(null);
  const [hoveredNewIndex, setHoveredNewIndex] = useState<number | null>(null);
  const [expandedOldIndex, setExpandedOldIndex] = useState<number | null>(null);
  const [expandedNewIndex, setExpandedNewIndex] = useState<number | null>(null);
  const oldContainerRef = useRef<HTMLDivElement>(null);
  const newContainerRef = useRef<HTMLDivElement>(null);
  const oldIndexRefs = useRef<Map<number, HTMLDivElement>>(new Map());
  const newIndexRefs = useRef<Map<number, HTMLDivElement>>(new Map());

  const scrollToIndex = (index: number, isOld: boolean) => {
    const refs = isOld ? oldIndexRefs.current : newIndexRefs.current;
    const container = isOld ? oldContainerRef.current : newContainerRef.current;
    const element = refs.get(index);

    if (element && container) {
      const containerRect = container.getBoundingClientRect();
      const elementRect = element.getBoundingClientRect();
      const scrollLeft =
        element.offsetLeft -
        container.offsetLeft -
        containerRect.width / 2 +
        elementRect.width / 2;

      container.scrollTo({
        left: scrollLeft,
        behavior: "smooth",
      });
    }
  };

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
          stats.moved++;
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

  // Build old and new arrays with only changed items
  const oldItems: IndexItem[] = [];
  const newItems: IndexItem[] = [];

  itemChanges.forEach((change) => {
    if (change.kind === "ItemRemove" && change.oldIndex !== undefined) {
      oldItems.push({
        index: change.oldIndex,
        state: "removed",
        data: change.data ?? oldValue?.[change.oldIndex],
      });
    } else if (
      change.kind === "ItemIndexChange" &&
      change.oldIndex !== undefined &&
      change.index !== undefined
    ) {
      oldItems.push({
        index: change.oldIndex,
        state: "moved",
        data: change.data ?? oldValue?.[change.oldIndex],
        newIndex: change.index,
      });
      newItems.push({
        index: change.index,
        state: "moved",
        data: change.data ?? newValue?.[change.index],
        oldIndex: change.oldIndex,
      });
    } else if (change.kind === "ItemUpdate") {
      const idx = change.index ?? change.oldIndex;
      if (idx !== undefined) {
        oldItems.push({
          index: idx,
          state: "updated",
          data: oldValue?.[idx],
        });
        newItems.push({
          index: idx,
          state: "updated",
          data: change.data ?? newValue?.[idx],
        });
      }
    } else if (change.kind === "ItemAdd" && change.index !== undefined) {
      newItems.push({
        index: change.index,
        state: "added",
        data: change.data ?? newValue?.[change.index],
      });
    }
  });

  // Sort items by index
  const sortedOldItems = oldItems.sort((a, b) => a.index - b.index);
  const sortedNewItems = newItems.sort((a, b) => a.index - b.index);

  // Add gaps between non-consecutive indices
  const addGaps = (items: IndexItem[]): (IndexItem | "gap")[] => {
    if (items.length === 0) return [];

    const result: (IndexItem | "gap")[] = [];

    // Add gap at the beginning if first item doesn't start at index 0
    if (items[0].index > 0) {
      result.push("gap");
    }

    items.forEach((item, i) => {
      if (i > 0) {
        const prevIndex = items[i - 1].index;
        if (item.index - prevIndex > 1) {
          result.push("gap");
        }
      }
      result.push(item);
    });
    return result;
  };

  const oldItemsWithGaps = addGaps(sortedOldItems);
  const newItemsWithGaps = addGaps(sortedNewItems);

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

  const hasOldChanges = oldItemsWithGaps.length > 0;
  const hasNewChanges = newItemsWithGaps.length > 0;

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

      {/* Navigation Map */}
      {(sortedOldItems.length > 3 || sortedNewItems.length > 3) && (
        <div className={classes.navigationMap}>
          <Text className={classes.navLabel}>
            <Navigation20Regular />
            Quick Navigation:
          </Text>
          {hasOldChanges && sortedOldItems.length > 0 && (
            <>
              <Text
                style={{
                  fontSize: tokens.fontSizeBase100,
                  color: tokens.colorNeutralForeground3,
                }}
              >
                Old:
              </Text>
              {sortedOldItems.map((item) => (
                <Button
                  key={`nav-old-${item.index}`}
                  size="small"
                  appearance={
                    item.state === "removed"
                      ? "primary"
                      : item.state === "moved"
                      ? "outline"
                      : "subtle"
                  }
                  className={classes.navButton}
                  onClick={() => scrollToIndex(item.index, true)}
                  title={`Scroll to index ${item.index} (${item.state})`}
                >
                  [{item.index}]
                </Button>
              ))}
            </>
          )}
          {hasNewChanges && sortedNewItems.length > 0 && (
            <>
              <Text
                style={{
                  fontSize: tokens.fontSizeBase100,
                  color: tokens.colorNeutralForeground3,
                  marginLeft: tokens.spacingHorizontalM,
                }}
              >
                New:
              </Text>
              {sortedNewItems.map((item) => (
                <Button
                  key={`nav-new-${item.index}`}
                  size="small"
                  appearance={
                    item.state === "added"
                      ? "primary"
                      : item.state === "moved"
                      ? "outline"
                      : "subtle"
                  }
                  className={classes.navButton}
                  onClick={() => scrollToIndex(item.index, false)}
                  title={`Scroll to index ${item.index} (${item.state})`}
                >
                  [{item.index}]
                </Button>
              ))}
            </>
          )}
        </div>
      )}

      <div className={classes.visualContainer}>
        {/* Old Array */}
        <div className={classes.indexRow}>
          <Text className={classes.rowLabel}>Old Array (Before):</Text>
          <div className={classes.scrollableContainer} ref={oldContainerRef}>
            {!hasOldChanges ? (
              <div className={classes.noChangesMessage}>
                All items unchanged
              </div>
            ) : (
              <div className={classes.indexBoxesContainer}>
                {oldItemsWithGaps.map((item, idx) => {
                  if (item === "gap") {
                    return (
                      <div
                        key={`gap-old-${idx}`}
                        className={classes.ellipsisIndicator}
                      >
                        ⋯
                      </div>
                    );
                  }

                  const isExpanded = expandedOldIndex === item.index;

                  return (
                    <div
                      key={`old-${item.index}`}
                      className={classes.indexBox}
                      ref={(el) => {
                        if (el) oldIndexRefs.current.set(item.index, el);
                      }}
                      onMouseEnter={() => {
                        if (item.state === "moved") {
                          setHoveredOldIndex(item.index);
                          setHoveredNewIndex(item.newIndex ?? null);
                        }
                      }}
                      onMouseLeave={() => {
                        setHoveredOldIndex(null);
                        setHoveredNewIndex(null);
                      }}
                      onClick={() =>
                        setExpandedOldIndex(isExpanded ? null : item.index)
                      }
                    >
                      <div className={classes.indexLabel}>
                        <Text>[{item.index}]</Text>
                        <Text
                          className={`${classes.stateLabel} ${
                            item.state === "removed"
                              ? classes.labelRemoved
                              : item.state === "moved"
                              ? classes.labelMoved
                              : item.state === "updated"
                              ? classes.labelUpdated
                              : ""
                          }`}
                        >
                          {item.state}
                        </Text>
                      </div>
                      <div
                        className={`${classes.indexContent} ${
                          isExpanded
                            ? classes.indexContentExpanded
                            : classes.indexContentCollapsed
                        } ${
                          item.state === "removed"
                            ? classes.removed
                            : item.state === "moved"
                            ? hoveredOldIndex === item.index
                              ? classes.movedHovered
                              : classes.moved
                            : item.state === "updated"
                            ? classes.updated
                            : ""
                        }`}
                      >
                        {isExpanded
                          ? formatValueForDisplay(item.data)
                          : formatDataPreview(item.data)}
                      </div>
                      {hoveredOldIndex === item.index &&
                        item.state === "moved" &&
                        item.newIndex !== undefined && (
                          <Text className={classes.hoverInfo}>
                            → moves to [{item.newIndex}]
                          </Text>
                        )}
                    </div>
                  );
                })}
                {/* Disclaimer note */}
                {oldItemsWithGaps.length > 0 && (
                  <div className={classes.disclaimerNote}>
                    (may have more unchanged items)
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Arrow */}
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            color: tokens.colorNeutralForeground3,
          }}
        >
          <ArrowDown20Regular className={classes.arrow} />
        </div>

        {/* New Array */}
        <div className={classes.indexRow}>
          <Text className={classes.rowLabel}>New Array (After):</Text>
          <div className={classes.scrollableContainer} ref={newContainerRef}>
            <div className={classes.indexBoxesContainer}>
              {newItemsWithGaps.map((item, idx) => {
                if (item === "gap") {
                  return (
                    <div
                      key={`gap-new-${idx}`}
                      className={classes.ellipsisIndicator}
                    >
                      ⋯
                    </div>
                  );
                }

                const isExpanded = expandedNewIndex === item.index;

                return (
                  <div
                    key={`new-${item.index}`}
                    className={classes.indexBox}
                    ref={(el) => {
                      if (el) newIndexRefs.current.set(item.index, el);
                    }}
                    onMouseEnter={() => {
                      if (item.state === "moved") {
                        setHoveredOldIndex(item.oldIndex ?? null);
                        setHoveredNewIndex(item.index);
                      }
                    }}
                    onMouseLeave={() => {
                      setHoveredOldIndex(null);
                      setHoveredNewIndex(null);
                    }}
                    onClick={() =>
                      setExpandedNewIndex(isExpanded ? null : item.index)
                    }
                  >
                    <div className={classes.indexLabel}>
                      <Text>[{item.index}]</Text>
                      <Text
                        className={`${classes.stateLabel} ${
                          item.state === "added"
                            ? classes.labelAdded
                            : item.state === "moved"
                            ? classes.labelMoved
                            : item.state === "updated"
                            ? classes.labelUpdated
                            : ""
                        }`}
                      >
                        {item.state}
                      </Text>
                    </div>
                    <div
                      className={`${classes.indexContent} ${
                        isExpanded
                          ? classes.indexContentExpanded
                          : classes.indexContentCollapsed
                      } ${
                        item.state === "added"
                          ? classes.added
                          : item.state === "moved"
                          ? hoveredNewIndex === item.index
                            ? classes.movedHovered
                            : classes.moved
                          : item.state === "updated"
                          ? classes.updated
                          : ""
                      }`}
                    >
                      {isExpanded
                        ? formatValueForDisplay(item.data)
                        : formatDataPreview(item.data)}
                    </div>
                    {hoveredNewIndex === item.index &&
                      item.state === "moved" &&
                      item.oldIndex !== undefined && (
                        <Text className={classes.hoverInfo}>
                          ← from [{item.oldIndex}]
                        </Text>
                      )}
                  </div>
                );
              })}
              {/* Disclaimer note */}
              {newItemsWithGaps.length > 0 && (
                <div className={classes.disclaimerNote}>
                  (may have more unchanged items)
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
