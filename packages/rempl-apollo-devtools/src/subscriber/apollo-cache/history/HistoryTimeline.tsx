import React from "react";
import { Text } from "@fluentui/react-components";
import type { HistoryEntry } from "../../../history/types";
import { TimelineItem } from "./components/TimelineItem";
import { useHistoryTimelineStyles } from "./HistoryTimeline.styles";

interface HistoryTimelineProps {
  history: HistoryEntry[];
  selectedIndex: number | null;
  totalCount?: number;
  onSelectEntry: (index: number) => void;
}

export const HistoryTimeline: React.FC<HistoryTimelineProps> = ({
  history,
  selectedIndex,
  totalCount = 0,
  onSelectEntry,
}) => {
  const classes = useHistoryTimelineStyles();

  const startingUpdateNumber =
    totalCount > history.length ? totalCount - history.length + 1 : 1;

  const timelineTitle =
    totalCount > history.length
      ? `Last ${history.length} updates (out of ${totalCount})`
      : "Timeline";

  return (
    <div className={classes.container}>
      <div className={classes.header}>
        <Text weight="semibold" size={400}>
          {timelineTitle}
        </Text>
      </div>
      <div className={classes.list}>
        {history.map((entry, index) => (
          <TimelineItem
            key={index}
            entry={entry}
            index={startingUpdateNumber + index}
            isSelected={selectedIndex === index}
            onClick={() => onSelectEntry(index)}
          />
        ))}
      </div>
    </div>
  );
};
