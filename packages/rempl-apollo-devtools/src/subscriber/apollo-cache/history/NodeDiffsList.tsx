import React from "react";
import { Text, tokens } from "@fluentui/react-components";
import type { SerializedNodeDifference } from "@graphitation/apollo-forest-run";
import { useNodeDiffsListStyles } from "./NodeDiffsList.styles";
import { FieldChangeItem } from "./components/FieldChangeItem";

interface NodeDiffsListProps {
  nodeDiffs: SerializedNodeDifference[];
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
  nodeDiff: SerializedNodeDifference;
  classes: ReturnType<typeof useNodeDiffsListStyles>;
}

const NodeDiffItem: React.FC<NodeDiffItemProps> = ({ nodeDiff, classes }) => {
  const { diff } = nodeDiff;
  const hasFieldState = diff.fieldState && diff.fieldState.length > 0;
  const hasDirtyFields = diff.dirtyFields && diff.dirtyFields.length > 0;

  return (
    <div className={classes.nodeDiffItem}>
      {/* Node Header */}
      <div className={classes.nodeHeader}>
        <Text className={classes.nodeKey}>{nodeDiff.nodeKey}</Text>
      </div>

      {/* Field Changes */}
      {hasFieldState && (
        <div>
          <Text className={classes.fieldsLabel}>Changed Fields:</Text>
          <div className={classes.fieldsList}>
            {diff.fieldState!.map((fieldState, idx) => {
              const value = fieldState.value;
              const diffs = Array.isArray(value) ? value : [value];
              return (
                <div key={idx}>
                  {diffs.map((d, i) => {
                    // We adapt the NodeDiff state to look like a FieldChange
                    // so we can reuse the FieldChangeItem component.
                    // The 'kind' property is included in 'd.state'.
                    const change = {
                      path: [fieldState.key],
                      ...d.state,
                    };
                    return <FieldChangeItem key={i} change={change as any} />;
                  })}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Dirty Fields (when no field state) */}
      {!hasFieldState && hasDirtyFields && (
        <div>
          <Text className={classes.fieldsLabel}>Dirty Fields:</Text>
          <div className={classes.fieldsList}>
            {diff.dirtyFields!.map((field, idx) => (
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
