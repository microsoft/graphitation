import React, { useState } from "react";
import { Text, mergeClasses } from "@fluentui/react-components";
import { ChevronRight20Regular } from "@fluentui/react-icons";
import type { HistoryFieldChange } from "@graphitation/apollo-forest-run";
import { DifferenceKind } from "@graphitation/apollo-forest-run";
import { ArrayDiffViewer } from "../ArrayDiffViewer";
import { useFieldChangesListStyles } from "../FieldChangesList.styles";
import { formatValue } from "../shared/diffUtils";

interface FieldChangeItemProps {
  change: HistoryFieldChange;
  isOptimistic?: boolean;
}

const RICH_HISTORY_PLACEHOLDER = "Enable enableRichHistory for full path";

const isRichHistoryDisabled = (path: (string | number)[]): boolean => {
  return path.length > 0 && path[0] === RICH_HISTORY_PLACEHOLDER;
};

const formatFieldPath = (path: (string | number)[]): string => {
  if (isRichHistoryDisabled(path)) {
    // Extract the actual field name(s) after the placeholder
    const actualFields = path.slice(1);
    if (actualFields.length > 0) {
      return `${actualFields.join(
        ".",
      )} (enable enableRichHistory for full path)`;
    }
    return "(enable enableRichHistory for full path)";
  }
  return path.join(".");
};

export const FieldChangeItem: React.FC<FieldChangeItemProps> = ({
  change,
  isOptimistic,
}) => {
  const classes = useFieldChangesListStyles();
  const [isExpanded, setIsExpanded] = useState(false);

  const fieldPath = formatFieldPath(change.path);
  const changeKind = change.kind;
  const richHistoryDisabled = isRichHistoryDisabled(change.path);

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
      const replacementChange = change;
      return `${formatValuePreview(
        replacementChange.oldValue,
      )} → ${formatValuePreview(replacementChange.newValue)}`;
    } else if (change.kind === DifferenceKind.Filler) {
      const fillerChange = change;
      return `Added: ${formatValuePreview(fillerChange.newValue)}`;
    } else if (change.kind === DifferenceKind.CompositeListDifference) {
      const listChange = change;
      const itemCount = listChange.itemChanges?.length;
      if (itemCount !== undefined) {
        return `${itemCount} item ${itemCount === 1 ? "change" : "changes"}`;
      }
      return "List layout changed";
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
          {richHistoryDisabled && (
            <div className={classes.valueBox}>
              <Text style={{ fontStyle: "italic", color: "#666" }}>
                Full path and value data unavailable. Enable{" "}
                <code
                  style={{
                    background: "#f5f5f5",
                    padding: "2px 4px",
                    borderRadius: "3px",
                  }}
                >
                  enableRichHistory
                </code>{" "}
                in your Apollo Forest Run configuration to see complete details.
              </Text>
            </div>
          )}
          {change.kind === DifferenceKind.Replacement && (
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
          {change.kind === DifferenceKind.Filler && (
            <div className={classes.valueBox}>
              <Text className={classes.valueLabel}>Value</Text>
              <pre className={classes.codeBlock}>
                {formatValue(change.newValue)}
              </pre>
            </div>
          )}
          {change.kind === DifferenceKind.CompositeListDifference &&
            (change.itemChanges ? (
              <ArrayDiffViewer
                itemChanges={change.itemChanges}
                previousLength={change.previousLength}
                currentLength={change.currentLength}
                isOptimistic={isOptimistic}
              />
            ) : (
              <div className={classes.valueBox}>
                <Text style={{ fontStyle: "italic" }}>
                  Detailed list difference view is not available for optimistic
                  updates.
                </Text>
              </div>
            ))}
        </div>
      )}
    </div>
  );
};

// Helper functions
function formatValuePreview(value: unknown): string {
  if (value === undefined) return "(unavailable)";
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
