import React, { useState } from "react";
import { Text, mergeClasses } from "@fluentui/react-components";
import { ChevronRight20Regular } from "@fluentui/react-icons";
import type { FieldChange } from "../../../history/types";
import { DifferenceKind } from "../../../history/types";
import { ArrayDiffViewer } from "./ArrayDiffViewer";
import { useFieldChangesListStyles } from "./FieldChangesList.styles";

interface FieldChangesListProps {
  changes: FieldChange[];
}

export const FieldChangesList: React.FC<FieldChangesListProps> = ({
  changes,
}) => {
  const classes = useFieldChangesListStyles();

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
  classes: ReturnType<typeof useFieldChangesListStyles>;
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
      case DifferenceKind.Filler:
        return classes.badgeFiller;
      case DifferenceKind.Replacement:
        return classes.badgeReplacement;
      case DifferenceKind.CompositeListDifference:
        return classes.badgeList;
      default:
        return classes.badgeReplacement;
    }
  };

  const getChangeLabel = () => {
    switch (changeKind) {
      case DifferenceKind.Filler:
        return "Filled";
      case DifferenceKind.Replacement:
        return "Modified";
      case DifferenceKind.CompositeListDifference:
        return "List Change";
      default:
        return String(changeKind);
    }
  };

  const getPreviewText = () => {
    if (change.kind === DifferenceKind.Replacement) {
      const replacementChange = change as any;
      return `${formatValuePreview(
        replacementChange.oldValue,
      )} → ${formatValuePreview(replacementChange.newValue)}`;
    } else if (change.kind === DifferenceKind.Filler) {
      const fillerChange = change as any;
      return `Added: ${formatValuePreview(fillerChange.newValue)}`;
    } else if (change.kind === DifferenceKind.CompositeListDifference) {
      const listChange = change as any;
      const itemCount = listChange.itemChanges?.length || 0;
      return `${itemCount} item ${itemCount === 1 ? "change" : "changes"}`;
    }
    return "";
  };

  return (
    <div className={classes.changeItem}>
      <div
        className={classes.fieldItem}
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <Text className={classes.fieldPath}>{fieldPath}</Text>
        <Text
          className={mergeClasses(classes.changeKindBadge, getBadgeClass())}
        >
          {getChangeLabel()}
        </Text>
        <Text className={classes.previewText}>{getPreviewText()}</Text>
        <ChevronRight20Regular
          className={mergeClasses(
            classes.chevron,
            isExpanded && classes.chevronExpanded,
          )}
        />
      </div>
      {isExpanded && (
        <div className={classes.changeContent}>
          {change.kind === DifferenceKind.Replacement && (
            <div className={classes.valueComparison}>
              <div className={classes.valueBox}>
                <Text className={classes.valueLabel}>Previous Value</Text>
                <pre className={classes.codeBlock}>
                  {formatValue((change as any).oldValue)}
                </pre>
              </div>
              <div className={classes.valueBox}>
                <Text className={classes.valueLabel}>New Value</Text>
                <pre className={classes.codeBlock}>
                  {formatValue((change as any).newValue)}
                </pre>
              </div>
            </div>
          )}
          {change.kind === DifferenceKind.Filler && (
            <div className={classes.valueBox}>
              <Text className={classes.valueLabel}>Value</Text>
              <pre className={classes.codeBlock}>
                {formatValue((change as any).newValue)}
              </pre>
            </div>
          )}
          {change.kind === DifferenceKind.CompositeListDifference && (
            <ArrayDiffViewer
              itemChanges={(change as any).itemChanges}
              previousLength={(change as any).previousLength}
              currentLength={(change as any).currentLength}
            />
          )}
        </div>
      )}
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

  // If it's a string, check if it's JSON
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      // If successfully parsed and it's an object or array, format it
      if (typeof parsed === "object" && parsed !== null) {
        return JSON.stringify(parsed, null, 2);
      }
    } catch {
      // Not JSON, return the string as-is
      return value;
    }
    return value;
  }

  // For objects, arrays, and other types, stringify with formatting
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}
