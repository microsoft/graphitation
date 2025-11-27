import React from "react";
import {
  Text,
  mergeClasses,
  Tag,
  tokens,
  Tooltip,
} from "@fluentui/react-components";
import { Warning16Filled } from "@fluentui/react-icons";
import type { HistoryChangeSerialized } from "@graphitation/apollo-forest-run";
import { useTimelineItemStyles } from "./TimelineItem.styles";

export interface TimelineItemProps {
  entry: HistoryChangeSerialized;
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
    entry.kind === "Regular" &&
    entry.missingFields &&
    entry.missingFields.length > 0;
  const missingFieldsCount = hasIncompleteData
    ? entry.missingFields!.reduce((sum, mf) => sum + mf.fields.length, 0)
    : 0;

  const changeCount = entry.changes.length;

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
        <Text className={classes.itemTime}>
          {new Date(entry.timestamp).toLocaleTimeString()}
        </Text>
      </div>
      <Text
        className={classes.operationName}
        title={entry.modifyingOperation?.name || "Anonymous Operation"}
      >
        {entry.modifyingOperation?.name || "Anonymous Operation"}
      </Text>
      <div className={classes.tagRow}>
        {changeCount > 0 && (
          <Tooltip
            content="Total number of field changes captured in this update"
            relationship="description"
          >
            <Tag size="small" appearance="outline">
              {changeCount} {changeCount === 1 ? "change" : "changes"}
            </Tag>
          </Tooltip>
        )}
        {isOptimistic && (
          <Tooltip
            content="This update comes from an optimistic response"
            relationship="description"
          >
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
          </Tooltip>
        )}
        {hasIncompleteData && (
          <Tooltip
            content="Some fields expected by the cache are missing in this update"
            relationship="description"
          >
            <Tag
              size="small"
              appearance="filled"
              icon={<Warning16Filled />}
              style={{
                backgroundColor: tokens.colorStatusWarningBackground2,
                color: tokens.colorNeutralForeground1,
                display: "flex",
                alignItems: "center",
                gap: 4,
              }}
            >
              Missing fields ({missingFieldsCount})
            </Tag>
          </Tooltip>
        )}
      </div>
    </div>
  );
};
