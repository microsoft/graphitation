import React, { useState } from "react";
import {
  makeStyles,
  shorthands,
  tokens,
  Text,
  mergeClasses,
} from "@fluentui/react-components";
import { ChevronRight20Regular } from "@fluentui/react-icons";
import type { FieldChange, ListItemChange } from "../../../history/types";

const useStyles = makeStyles({
  container: {
    display: "flex",
    flexDirection: "column",
    ...shorthands.gap(tokens.spacingVerticalS),
  },
  emptyState: {
    ...shorthands.padding(tokens.spacingVerticalL),
    textAlign: "center",
    color: tokens.colorNeutralForeground3,
    fontStyle: "italic",
  },
  changeItem: {
    ...shorthands.borderRadius(tokens.borderRadiusMedium),
    ...shorthands.border(
      tokens.strokeWidthThin,
      "solid",
      tokens.colorNeutralStroke2,
    ),
    ...shorthands.overflow("hidden"),
  },
  changeHeader: {
    display: "flex",
    alignItems: "center",
    ...shorthands.gap(tokens.spacingHorizontalS),
    ...shorthands.padding(tokens.spacingVerticalS, tokens.spacingHorizontalM),
    cursor: "pointer",
    backgroundColor: tokens.colorNeutralBackground2,
    ...shorthands.transition("background-color", "0.15s"),
    "&:hover": {
      backgroundColor: tokens.colorNeutralBackground2Hover,
    },
  },
  chevron: {
    fontSize: "16px",
    color: tokens.colorNeutralForeground3,
    ...shorthands.transition("transform", "0.2s"),
    flexShrink: 0,
  },
  chevronExpanded: {
    transform: "rotate(90deg)",
  },
  fieldPath: {
    fontFamily: tokens.fontFamilyMonospace,
    fontWeight: tokens.fontWeightSemibold,
    color: tokens.colorNeutralForeground1,
    ...shorthands.flex(1),
    fontSize: tokens.fontSizeBase300,
  },
  changeKindBadge: {
    fontSize: tokens.fontSizeBase100,
    ...shorthands.padding(
      tokens.spacingVerticalXXS,
      tokens.spacingHorizontalXS,
    ),
    ...shorthands.borderRadius(tokens.borderRadiusSmall),
    fontWeight: tokens.fontWeightSemibold,
  },
  badgeFiller: {
    backgroundColor: "rgba(16, 124, 16, 0.15)",
    color: tokens.colorPaletteGreenForeground1,
  },
  badgeReplacement: {
    backgroundColor: "rgba(0, 120, 212, 0.15)",
    color: tokens.colorBrandForeground1,
  },
  badgeList: {
    backgroundColor: "rgba(245, 159, 0, 0.15)",
    color: tokens.colorPaletteYellowForeground1,
  },
  previewText: {
    color: tokens.colorNeutralForeground2,
    fontSize: tokens.fontSizeBase200,
    maxWidth: "300px",
    ...shorthands.overflow("hidden"),
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  changeContent: {
    ...shorthands.padding(tokens.spacingVerticalM, tokens.spacingHorizontalM),
    backgroundColor: tokens.colorNeutralBackground1,
  },
  valueComparison: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    ...shorthands.gap(tokens.spacingHorizontalM),
  },
  valueBox: {
    display: "flex",
    flexDirection: "column",
    ...shorthands.gap(tokens.spacingVerticalXS),
  },
  valueLabel: {
    fontSize: tokens.fontSizeBase200,
    fontWeight: tokens.fontWeightSemibold,
    color: tokens.colorNeutralForeground2,
  },
  codeBlock: {
    fontFamily: tokens.fontFamilyMonospace,
    fontSize: tokens.fontSizeBase200,
    ...shorthands.padding(tokens.spacingVerticalS, tokens.spacingHorizontalS),
    backgroundColor: tokens.colorNeutralBackground3,
    ...shorthands.borderRadius(tokens.borderRadiusMedium),
    ...shorthands.overflow("auto"),
    maxHeight: "300px",
    ...shorthands.border(
      tokens.strokeWidthThin,
      "solid",
      tokens.colorNeutralStroke2,
    ),
  },
  listItemsContainer: {
    display: "flex",
    flexDirection: "column",
    ...shorthands.gap(tokens.spacingVerticalS),
  },
  listItem: {
    ...shorthands.padding(tokens.spacingVerticalS, tokens.spacingHorizontalS),
    backgroundColor: tokens.colorNeutralBackground2,
    ...shorthands.borderRadius(tokens.borderRadiusMedium),
    ...shorthands.border(
      tokens.strokeWidthThin,
      "solid",
      tokens.colorNeutralStroke2,
    ),
  },
  listItemHeader: {
    fontWeight: tokens.fontWeightSemibold,
    marginBottom: tokens.spacingVerticalXS,
  },
});

interface FieldChangesListProps {
  changes: FieldChange[];
}

export const FieldChangesList: React.FC<FieldChangesListProps> = ({
  changes,
}) => {
  const classes = useStyles();

  if (changes.length === 0) {
    return (
      <div className={classes.emptyState}>
        <Text>No field changes recorded</Text>
      </div>
    );
  }

  return (
    <div className={classes.container}>
      {changes.map((change, index) => (
        <FieldChangeItem key={index} change={change} classes={classes} />
      ))}
    </div>
  );
};

interface FieldChangeItemProps {
  change: FieldChange;
  classes: ReturnType<typeof useStyles>;
}

const FieldChangeItem: React.FC<FieldChangeItemProps> = ({
  change,
  classes,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);

  const fieldPath = change.path.join(".");
  const changeKind = change.kind;

  const getBadgeClass = () => {
    switch (changeKind) {
      case "Filler":
        return classes.badgeFiller;
      case "Replacement":
        return classes.badgeReplacement;
      case "CompositeListDifference":
        return classes.badgeList;
      default:
        return classes.badgeReplacement;
    }
  };

  const getChangeLabel = () => {
    switch (changeKind) {
      case "Filler":
        return "New";
      case "Replacement":
        return "Modified";
      case "CompositeListDifference":
        return "List Change";
      default:
        return changeKind;
    }
  };

  const getPreviewText = () => {
    if (changeKind === "Replacement") {
      return `${formatValuePreview(change.oldValue)} → ${formatValuePreview(
        change.newValue,
      )}`;
    } else if (changeKind === "Filler") {
      return `Added: ${formatValuePreview(change.newValue)}`;
    } else if (changeKind === "CompositeListDifference") {
      const itemCount = change.itemChanges?.length || 0;
      return `${itemCount} item ${itemCount === 1 ? "change" : "changes"}`;
    }
    return "";
  };

  return (
    <div className={classes.changeItem}>
      <div
        className={classes.changeHeader}
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <ChevronRight20Regular
          className={mergeClasses(
            classes.chevron,
            isExpanded && classes.chevronExpanded,
          )}
        />
        <Text className={classes.fieldPath}>{fieldPath}</Text>
        <Text
          className={mergeClasses(classes.changeKindBadge, getBadgeClass())}
        >
          {getChangeLabel()}
        </Text>
        <Text className={classes.previewText}>{getPreviewText()}</Text>
      </div>
      {isExpanded && (
        <div className={classes.changeContent}>
          {changeKind === "Replacement" && (
            <div className={classes.valueComparison}>
              <div className={classes.valueBox}>
                <Text className={classes.valueLabel}>Previous Value</Text>
                <pre className={classes.codeBlock}>
                  {formatValue(change.oldValue)}
                </pre>
              </div>
              <div className={classes.valueBox}>
                <Text className={classes.valueLabel}>New Value</Text>
                <pre className={classes.codeBlock}>
                  {formatValue(change.newValue)}
                </pre>
              </div>
            </div>
          )}
          {changeKind === "Filler" && (
            <div className={classes.valueBox}>
              <Text className={classes.valueLabel}>Value</Text>
              <pre className={classes.codeBlock}>
                {formatValue(change.newValue)}
              </pre>
            </div>
          )}
          {changeKind === "CompositeListDifference" && change.itemChanges && (
            <ListItemChanges items={change.itemChanges} classes={classes} />
          )}
        </div>
      )}
    </div>
  );
};

interface ListItemChangesProps {
  items: ListItemChange[];
  classes: ReturnType<typeof useStyles>;
}

const ListItemChanges: React.FC<ListItemChangesProps> = ({
  items,
  classes,
}) => {
  if (items.length === 0) {
    return <Text>List structure changed (no item details available)</Text>;
  }

  return (
    <div className={classes.listItemsContainer}>
      {items.map((item, index) => (
        <div key={index} className={classes.listItem}>
          <Text className={classes.listItemHeader}>
            {getListItemChangeDescription(item)}
          </Text>
          {item.data !== undefined && (
            <pre className={classes.codeBlock}>{formatValue(item.data)}</pre>
          )}
        </div>
      ))}
    </div>
  );
};

// Helper functions
function formatValuePreview(value: unknown): string {
  if (value === undefined) return "undefined";
  if (value === null) return "null";
  if (typeof value === "string") {
    return value.length > 20 ? `"${value.slice(0, 20)}..."` : `"${value}"`;
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  if (Array.isArray(value)) {
    return `Array(${value.length})`;
  }
  if (typeof value === "object") {
    const keys = Object.keys(value);
    return `{${keys.length} ${keys.length === 1 ? "field" : "fields"}}`;
  }
  return String(value);
}

function formatValue(value: unknown): string {
  if (value === undefined) return "undefined";
  if (value === null) return "null";
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function getListItemChangeDescription(item: ListItemChange): string {
  switch (item.kind) {
    case "ItemAdd":
      return `Item added at index ${item.index}`;
    case "ItemRemove":
      return `Item removed from index ${item.oldIndex}`;
    case "ItemIndexChange":
      return `Item moved from index ${item.oldIndex} to ${item.index}`;
    case "ItemUpdate":
      return `Item updated at index ${item.index || item.oldIndex}`;
    default:
      return `Item changed`;
  }
}
