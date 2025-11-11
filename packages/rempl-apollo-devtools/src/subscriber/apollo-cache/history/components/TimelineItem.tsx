import React from "react";
import { Text, mergeClasses, Tag, tokens } from "@fluentui/react-components";
import type { HistoryEntry } from "../../../../history/types";
import { formatTime } from "../shared/utils";
import { useTimelineItemStyles } from "./TimelineItem.styles";

export interface TimelineItemProps {
  entry: HistoryEntry;
  index: number;
  isSelected: boolean;
  onClick: () => void;
}

export const TimelineItem: React.FC<TimelineItemProps> = ({
  entry,
  index,
  isSelected,
  onClick,
}) => {
  const classes = useTimelineItemStyles();

  const hasIncompleteData =
    entry.missingFields && entry.missingFields.length > 0;
  const missingFieldsCount = hasIncompleteData
    ? entry.missingFields!.reduce((sum, mf) => sum + mf.fields.length, 0)
    : 0;

  const changeCount =
    entry.kind === "Regular" ? entry.changes.length : entry.nodeDiffs.length;

  const isOptimistic = entry.kind === "Optimistic";

  return (
    <div
      className={mergeClasses(classes.item, isSelected && classes.itemActive)}
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick();
        }
      }}
      aria-selected={isSelected}
    >
      <div className={classes.itemHeader}>
        <Text className={classes.itemTitle}>Update #{index}</Text>
        <Text className={classes.itemTime}>{formatTime(entry.timestamp)}</Text>
      </div>
      <Text className={classes.operationName}>
        {entry.modifyingOperation?.name || "Anonymous Operation"}
      </Text>
      <div className={classes.tagRow}>
        {changeCount > 0 && (
          <Tag size="small" appearance="outline">
            {changeCount} {changeCount === 1 ? "change" : "changes"}
          </Tag>
        )}
        {isOptimistic && (
          <Tag
            size="small"
            appearance="filled"
            style={{
              backgroundColor: tokens.colorBrandBackground2,
              color: tokens.colorNeutralForeground1,
            }}
          >
            Optimistic
          </Tag>
        )}
        {hasIncompleteData && (
          <Tag
            size="small"
            appearance="filled"
            style={{
              backgroundColor: tokens.colorStatusWarningBackground1,
              color: tokens.colorNeutralForeground1,
            }}
          >
            Missing fields ({missingFieldsCount})
          </Tag>
        )}
      </div>
    </div>
  );
};
