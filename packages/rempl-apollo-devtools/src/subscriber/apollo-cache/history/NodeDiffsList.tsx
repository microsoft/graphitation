import React from "react";
import {
  makeStyles,
  shorthands,
  tokens,
  Text,
  mergeClasses,
} from "@fluentui/react-components";
import type { NodeDiff, FieldState } from "../../../history/types";

const useStyles = makeStyles({
  container: {
    display: "flex",
    flexDirection: "column",
    ...shorthands.gap(tokens.spacingVerticalM),
  },
  emptyState: {
    ...shorthands.padding(tokens.spacingVerticalL),
    textAlign: "center",
    color: tokens.colorNeutralForeground3,
    fontStyle: "italic",
  },
  nodeDiffItem: {
    ...shorthands.padding(tokens.spacingVerticalM, tokens.spacingHorizontalM),
    ...shorthands.borderRadius(tokens.borderRadiusMedium),
    ...shorthands.border(
      tokens.strokeWidthThin,
      "solid",
      tokens.colorNeutralStroke2,
    ),
    backgroundColor: tokens.colorNeutralBackground1,
  },
  nodeHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: tokens.spacingVerticalM,
    paddingBottom: tokens.spacingVerticalS,
    ...shorthands.borderBottom(
      tokens.strokeWidthThin,
      "solid",
      tokens.colorNeutralStroke2,
    ),
  },
  nodeKey: {
    fontFamily: tokens.fontFamilyMonospace,
    fontWeight: tokens.fontWeightSemibold,
    color: tokens.colorBrandForeground1,
    fontSize: tokens.fontSizeBase300,
  },
  completeBadge: {
    fontSize: tokens.fontSizeBase200,
    ...shorthands.padding(tokens.spacingVerticalXXS, tokens.spacingHorizontalS),
    ...shorthands.borderRadius(tokens.borderRadiusSmall),
    fontWeight: tokens.fontWeightSemibold,
  },
  completeTrue: {
    backgroundColor: "rgba(16, 124, 16, 0.15)",
    color: tokens.colorPaletteGreenForeground1,
  },
  completeFalse: {
    backgroundColor: "rgba(229, 83, 75, 0.15)",
    color: tokens.colorPaletteRedForeground1,
  },
  fieldChanges: {
    display: "flex",
    flexDirection: "column",
    ...shorthands.gap(tokens.spacingVerticalM),
  },
  fieldChangeItem: {
    ...shorthands.padding(tokens.spacingVerticalS, tokens.spacingHorizontalM),
    backgroundColor: tokens.colorNeutralBackground2,
    ...shorthands.borderRadius(tokens.borderRadiusMedium),
  },
  fieldName: {
    fontFamily: tokens.fontFamilyMonospace,
    fontWeight: tokens.fontWeightSemibold,
    color: tokens.colorNeutralForeground1,
    fontSize: tokens.fontSizeBase300,
    marginBottom: tokens.spacingVerticalXS,
  },
  fieldValue: {
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
    whiteSpace: "pre",
  },
  dirtyFields: {
    ...shorthands.padding(tokens.spacingVerticalS, tokens.spacingHorizontalM),
    backgroundColor: tokens.colorNeutralBackground2,
    ...shorthands.borderRadius(tokens.borderRadiusMedium),
    marginTop: tokens.spacingVerticalS,
  },
  dirtyFieldsLabel: {
    fontWeight: tokens.fontWeightSemibold,
    marginBottom: tokens.spacingVerticalXS,
  },
  dirtyFieldsValue: {
    fontFamily: tokens.fontFamilyMonospace,
    color: tokens.colorNeutralForeground2,
  },
});

interface NodeDiffsListProps {
  nodeDiffs: NodeDiff[];
}

export const NodeDiffsList: React.FC<NodeDiffsListProps> = ({ nodeDiffs }) => {
  const classes = useStyles();

  if (nodeDiffs.length === 0) {
    return (
      <div className={classes.emptyState}>
        <Text>No node differences recorded</Text>
      </div>
    );
  }

  return (
    <div className={classes.container}>
      {nodeDiffs.map((nodeDiff, index) => (
        <NodeDiffItem key={index} nodeDiff={nodeDiff} classes={classes} />
      ))}
    </div>
  );
};

interface NodeDiffItemProps {
  nodeDiff: NodeDiff;
  classes: ReturnType<typeof useStyles>;
}

const NodeDiffItem: React.FC<NodeDiffItemProps> = ({ nodeDiff, classes }) => {
  const hasFieldState = nodeDiff.fieldState && nodeDiff.fieldState.length > 0;
  const hasDirtyFields =
    nodeDiff.dirtyFields && nodeDiff.dirtyFields.length > 0;

  return (
    <div className={classes.nodeDiffItem}>
      {/* Node Header */}
      <div className={classes.nodeHeader}>
        <Text className={classes.nodeKey}>{nodeDiff.nodeKey}</Text>
        {nodeDiff.complete !== undefined && (
          <Text
            className={mergeClasses(
              classes.completeBadge,
              nodeDiff.complete ? classes.completeTrue : classes.completeFalse,
            )}
          >
            {nodeDiff.complete ? "Complete" : "Incomplete"}
          </Text>
        )}
      </div>

      {/* Field Changes */}
      {hasFieldState && (
        <div className={classes.fieldChanges}>
          {nodeDiff.fieldState!.map((fieldState, idx) => (
            <div key={idx} className={classes.fieldChangeItem}>
              <Text className={classes.fieldName}>{fieldState.fieldKey}</Text>
              <pre className={classes.fieldValue}>
                {formatValue(
                  fieldState.newValue !== undefined
                    ? fieldState.newValue
                    : fieldState.oldValue,
                )}
              </pre>
            </div>
          ))}
        </div>
      )}

      {/* Dirty Fields (when no field state) */}
      {!hasFieldState && hasDirtyFields && (
        <div className={classes.dirtyFields}>
          <Text className={classes.dirtyFieldsLabel}>Dirty Fields:</Text>
          <Text className={classes.dirtyFieldsValue}>
            {nodeDiff.dirtyFields!.join(", ")}
          </Text>
        </div>
      )}

      {/* No data */}
      {!hasFieldState && !hasDirtyFields && (
        <Text style={{ color: tokens.colorNeutralForeground3 }}>
          No detailed field information available
        </Text>
      )}
    </div>
  );
};

// Helper function to format values
function formatValue(value: unknown): string {
  if (value === undefined) return "undefined";
  if (value === null) return "null";
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}
