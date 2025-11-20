import React, { RefObject } from "react";
import { Text } from "@fluentui/react-components";
import type { IndexItem } from "./arrayDiffUtils";
import { ArrayIndexItem } from "./ArrayIndexItem";
import { useArrayDiffViewerStyles } from "../ArrayDiffViewer.styles";

interface ArrayRowProps {
  label: string;
  items: (IndexItem | "gap")[];
  isOld: boolean;
  expandedIndex: number | null;
  hoveredOldIndex: number | null;
  hoveredNewIndex: number | null;
  onSetExpanded: (index: number | null) => void;
  onSetHovered: (oldIndex: number | null, newIndex: number | null) => void;
  containerRef: RefObject<HTMLDivElement>;
  indexRefs: Map<number, HTMLDivElement>;
  headerAction?: React.ReactNode;
}

export const ArrayRow: React.FC<ArrayRowProps> = ({
  label,
  items,
  isOld,
  expandedIndex,
  hoveredOldIndex,
  hoveredNewIndex,
  onSetExpanded,
  onSetHovered,
  containerRef,
  indexRefs,
  headerAction,
}) => {
  const classes = useArrayDiffViewerStyles();

  // Check if there are actual items (not just gaps)
  const actualItems = items.filter((item) => item !== "gap");
  const hasItems = actualItems.length > 0;

  return (
    <div className={classes.indexRow}>
      <div className={classes.rowLabel}>
        <Text>{label}</Text>
        {headerAction && <div>{headerAction}</div>}
      </div>
      <div className={classes.scrollableContainer} ref={containerRef}>
        {!hasItems ? (
          <div className={classes.noChangesMessage}>
            <em style={{ color: "#999" }}>Empty array</em>
          </div>
        ) : (
          <div className={classes.indexBoxesContainer}>
            {items.map((item, idx) => {
              if (item === "gap") {
                return (
                  <div
                    key={`gap-${isOld ? "old" : "new"}-${idx}`}
                    className={classes.ellipsisIndicator}
                  >
                    ⋯
                  </div>
                );
              }

              const isExpanded = expandedIndex === item.index;
              const hoveredIndex = isOld ? hoveredOldIndex : hoveredNewIndex;

              return (
                <ArrayIndexItem
                  key={`${isOld ? "old" : "new"}-${item.index}`}
                  item={item}
                  isExpanded={isExpanded}
                  isOld={isOld}
                  hoveredIndex={hoveredIndex}
                  onMouseEnter={() => {
                    if (item.state === "moved") {
                      onSetHovered(
                        isOld ? item.index : item.oldIndex ?? null,
                        isOld ? item.newIndex ?? null : item.index,
                      );
                    }
                  }}
                  onMouseLeave={() => onSetHovered(null, null)}
                  onClick={() => onSetExpanded(isExpanded ? null : item.index)}
                  setRef={(el) => {
                    if (el) indexRefs.set(item.index, el);
                  }}
                />
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
