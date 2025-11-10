import React from "react";
import {
  makeStyles,
  shorthands,
  tokens,
  Text,
  mergeClasses,
} from "@fluentui/react-components";
import type { HistoryEntry } from "../../../history/types";

const useStyles = makeStyles({
  container: {
    ...shorthands.borderRight(
      tokens.strokeWidthThin,
      "solid",
      tokens.colorNeutralStroke1,
    ),
    display: "flex",
    flexDirection: "column",
    ...shorthands.overflow("hidden"),
    height: "100%",
  },
  header: {
    ...shorthands.padding(tokens.spacingVerticalM, tokens.spacingHorizontalM),
    ...shorthands.borderBottom(
      tokens.strokeWidthThin,
      "solid",
      tokens.colorNeutralStroke1,
    ),
    backgroundColor: tokens.colorNeutralBackground2,
  },
  list: {
    overflowY: "auto",
    ...shorthands.padding(tokens.spacingVerticalS),
    ...shorthands.flex(1),
  },
  item: {
    ...shorthands.padding(tokens.spacingVerticalS, tokens.spacingHorizontalM),
    ...shorthands.margin(tokens.spacingVerticalXS, 0),
    ...shorthands.borderRadius(tokens.borderRadiusMedium),
    cursor: "pointer",
    display: "flex",
    flexDirection: "column",
    ...shorthands.gap(tokens.spacingVerticalXXS),
    ...shorthands.borderLeft("3px", "solid", "transparent"),
    ...shorthands.transition("all", "0.15s", "ease-in-out"),
    "&:hover": {
      backgroundColor: tokens.colorNeutralBackground1Hover,
      ...shorthands.borderLeft("3px", "solid", tokens.colorBrandStroke1),
    },
  },
  itemActive: {
    backgroundColor: tokens.colorBrandBackground2,
    ...shorthands.borderLeft("3px", "solid", tokens.colorBrandStroke1),
    "&:hover": {
      backgroundColor: tokens.colorBrandBackground2Hover,
    },
  },
  itemHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  },
  itemTitle: {
    fontWeight: tokens.fontWeightSemibold,
  },
  itemTime: {
    color: tokens.colorNeutralForeground3,
    fontFamily: tokens.fontFamilyMonospace,
    fontSize: tokens.fontSizeBase200,
  },
  operationName: {
    color: tokens.colorBrandForeground1,
    fontFamily: tokens.fontFamilyMonospace,
    fontSize: tokens.fontSizeBase200,
  },
  tagRow: {
    display: "flex",
    flexWrap: "wrap",
    ...shorthands.gap(tokens.spacingHorizontalXS),
  },
  tag: {
    fontSize: tokens.fontSizeBase100,
    ...shorthands.padding(
      tokens.spacingVerticalXXS,
      tokens.spacingHorizontalXS,
    ),
    ...shorthands.borderRadius(tokens.borderRadiusSmall),
  },
  tagOptimistic: {
    color: tokens.colorBrandForeground1,
    backgroundColor: "rgba(0, 120, 212, 0.15)",
    fontWeight: tokens.fontWeightSemibold,
  },
  tagChanges: {
    color: tokens.colorNeutralForeground2,
    backgroundColor: tokens.colorNeutralBackground3,
  },
  tagMissing: {
    color: tokens.colorPaletteYellowForeground1,
    backgroundColor: "rgba(255, 200, 100, 0.2)",
    fontWeight: tokens.fontWeightSemibold,
  },
});

interface HistoryTimelineProps {
  history: HistoryEntry[];
  selectedIndex: number | null;
  onSelectEntry: (index: number) => void;
}

export const HistoryTimeline: React.FC<HistoryTimelineProps> = ({
  history,
  selectedIndex,
  onSelectEntry,
}) => {
  const classes = useStyles();

  return (
    <div className={classes.container}>
      <div className={classes.header}>
        <Text weight="semibold" size={400}>
          Timeline
        </Text>
      </div>
      <div className={classes.list}>
        {history.map((entry, index) => (
          <TimelineItem
            key={index}
            entry={entry}
            index={index}
            isSelected={selectedIndex === index}
            onClick={() => onSelectEntry(index)}
            classes={classes}
          />
        ))}
      </div>
    </div>
  );
};

interface TimelineItemProps {
  entry: HistoryEntry;
  index: number;
  isSelected: boolean;
  onClick: () => void;
  classes: ReturnType<typeof useStyles>;
}

const TimelineItem: React.FC<TimelineItemProps> = ({
  entry,
  index,
  isSelected,
  onClick,
  classes,
}) => {
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
    >
      <div className={classes.itemHeader}>
        <Text className={classes.itemTitle}>Update #{index + 1}</Text>
        <Text className={classes.itemTime}>
          {new Date(entry.timestamp).toLocaleTimeString()}
        </Text>
      </div>
      <Text className={classes.operationName}>
        {entry.modifyingOperation?.name || "Anonymous Operation"}
      </Text>
      <div className={classes.tagRow}>
        {isOptimistic && (
          <Text className={mergeClasses(classes.tag, classes.tagOptimistic)}>
            Optimistic
          </Text>
        )}
        {changeCount > 0 && (
          <Text className={mergeClasses(classes.tag, classes.tagChanges)}>
            {changeCount} {changeCount === 1 ? "change" : "changes"}
          </Text>
        )}
        {hasIncompleteData && (
          <Text className={mergeClasses(classes.tag, classes.tagMissing)}>
            Missing fields ({missingFieldsCount})
          </Text>
        )}
      </div>
    </div>
  );
};
