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
  fieldsList: {
    display: "flex",
    flexWrap: "wrap",
    ...shorthands.gap(tokens.spacingHorizontalS),
    marginTop: tokens.spacingVerticalS,
  },
  fieldTag: {
    fontFamily: tokens.fontFamilyMonospace,
    fontSize: tokens.fontSizeBase200,
    ...shorthands.padding(tokens.spacingVerticalXXS, tokens.spacingHorizontalS),
    backgroundColor: tokens.colorNeutralBackground3,
    ...shorthands.borderRadius(tokens.borderRadiusSmall),
    ...shorthands.border(
      tokens.strokeWidthThin,
      "solid",
      tokens.colorNeutralStroke2,
    ),
    color: tokens.colorNeutralForeground2,
  },
  fieldsLabel: {
    fontWeight: tokens.fontWeightSemibold,
    fontSize: tokens.fontSizeBase300,
    color: tokens.colorNeutralForeground1,
    marginBottom: tokens.spacingVerticalXS,
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
        <div>
          <Text className={classes.fieldsLabel}>Changed Fields:</Text>
          <div className={classes.fieldsList}>
            {nodeDiff.fieldState!.map((fieldState, idx) => (
              <Text key={idx} className={classes.fieldTag}>
                {fieldState.fieldKey}
              </Text>
            ))}
          </div>
        </div>
      )}

      {/* Dirty Fields (when no field state) */}
      {!hasFieldState && hasDirtyFields && (
        <div>
          <Text className={classes.fieldsLabel}>Dirty Fields:</Text>
          <div className={classes.fieldsList}>
            {nodeDiff.dirtyFields!.map((field, idx) => (
              <Text key={idx} className={classes.fieldTag}>
                {field}
              </Text>
            ))}
          </div>
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
