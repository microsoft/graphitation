import React, { useState, useRef } from "react";
import { Text, Switch, tokens } from "@fluentui/react-components";
import { ArrowDown20Regular } from "@fluentui/react-icons";
import type { CompositeListLayoutChange as ListItemChange } from "@graphitation/apollo-forest-run";
import { useArrayDiffViewerStyles } from "./ArrayDiffViewer.styles";
import {
  getSummary,
  buildIndexItems,
  addGaps,
} from "./components/arrayDiffUtils";
import { ListViewMode } from "./components/ListViewMode";
import { ArrayRow } from "./components/ArrayRow";

interface ArrayDiffViewerProps {
  itemChanges: ListItemChange[];
  previousLength?: number;
  currentLength?: number;
}

export const ArrayDiffViewer: React.FC<ArrayDiffViewerProps> = ({
  itemChanges,
  previousLength,
  currentLength,
}) => {
  const classes = useArrayDiffViewerStyles();
  const [showVisual, setShowVisual] = useState(true);
  const [hoveredOldIndex, setHoveredOldIndex] = useState<number | null>(null);
  const [hoveredNewIndex, setHoveredNewIndex] = useState<number | null>(null);
  const [expandedOldIndex, setExpandedOldIndex] = useState<number | null>(null);
  const [expandedNewIndex, setExpandedNewIndex] = useState<number | null>(null);
  const oldContainerRef = useRef<HTMLDivElement>(null);
  const newContainerRef = useRef<HTMLDivElement>(null);
  const oldIndexRefs = useRef<Map<number, HTMLDivElement>>(new Map());
  const newIndexRefs = useRef<Map<number, HTMLDivElement>>(new Map());

  const summary = getSummary(itemChanges);

  // Build old and new index items
  const { oldItems, newItems } = buildIndexItems(itemChanges);

  // Sort items by index
  const sortedOldItems = oldItems.sort((a, b) => a.index - b.index);
  const sortedNewItems = newItems.sort((a, b) => a.index - b.index);

  // Use the lengths provided by Forest-Run
  const oldLength = previousLength ?? 0;
  const newLength = currentLength ?? 0;

  // Add gaps between non-consecutive indices
  const oldItemsWithGaps = addGaps(sortedOldItems, oldLength);
  const newItemsWithGaps = addGaps(sortedNewItems, newLength);

  const handleSetHovered = (
    oldIndex: number | null,
    newIndex: number | null,
  ) => {
    setHoveredOldIndex(oldIndex);
    setHoveredNewIndex(newIndex);
  };

  if (!showVisual) {
    return (
      <div className={classes.container}>
        <div className={classes.summaryRow}>
          <div />
          <div className={classes.summaryControls}>
            <Text className={classes.summary}>{summary}</Text>
            <Switch
              label="Diff view"
              checked={showVisual}
              onChange={(_, data) => setShowVisual(data.checked)}
            />
          </div>
        </div>
        <ListViewMode itemChanges={itemChanges} />
      </div>
    );
  }

  return (
    <div className={classes.container}>
      <div className={classes.visualContainer}>
        <ArrayRow
          label="Old Array (Before):"
          items={oldItemsWithGaps}
          isOld={true}
          expandedIndex={expandedOldIndex}
          hoveredOldIndex={hoveredOldIndex}
          hoveredNewIndex={hoveredNewIndex}
          onSetExpanded={setExpandedOldIndex}
          onSetHovered={handleSetHovered}
          containerRef={oldContainerRef}
          indexRefs={oldIndexRefs.current}
          headerAction={
            <div className={classes.summaryControls}>
              <Text className={classes.summary}>{summary}</Text>
              <Switch
                label="Diff view"
                checked={showVisual}
                onChange={(_, data) => setShowVisual(data.checked)}
              />
            </div>
          }
        />

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

        <ArrayRow
          label="New Array (After):"
          items={newItemsWithGaps}
          isOld={false}
          expandedIndex={expandedNewIndex}
          hoveredOldIndex={hoveredOldIndex}
          hoveredNewIndex={hoveredNewIndex}
          onSetExpanded={setExpandedNewIndex}
          onSetHovered={handleSetHovered}
          containerRef={newContainerRef}
          indexRefs={newIndexRefs.current}
        />
      </div>
    </div>
  );
};
