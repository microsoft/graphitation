import React from "react";
import { Text, mergeClasses, tokens } from "@fluentui/react-components";
import type { NodeDiff } from "../../../history/types";
import { useNodeDiffsListStyles } from "./NodeDiffsList.styles";

interface NodeDiffsListProps {
  nodeDiffs: NodeDiff[];
}

export const NodeDiffsList: React.FC<NodeDiffsListProps> = ({ nodeDiffs }) => {
  const classes = useNodeDiffsListStyles();

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
  classes: ReturnType<typeof useNodeDiffsListStyles>;
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
