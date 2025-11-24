import React from "react";
import { Text, Badge } from "@fluentui/react-components";
import { CodeBlock } from "../shared";
import { useOperationMetadataStyles } from "./OperationMetadata.styles";

export interface OperationMetadataProps {
  operationName?: string;
  variables?: Record<string, unknown>;
  isOptimistic?: boolean;
}

export const OperationMetadata: React.FC<OperationMetadataProps> = ({
  operationName,
  variables,
  isOptimistic = false,
}) => {
  const classes = useOperationMetadataStyles();

  const hasVariables = variables && Object.keys(variables).length > 0;
  const variablesString = hasVariables ? JSON.stringify(variables) : "";
  const shouldInlineVariables = variablesString.length <= 50;

  if (!operationName && !hasVariables) {
    return null;
  }

  return (
    <div className={classes.container}>
      {operationName && (
        <div className={classes.metaItem}>
          <span className={classes.label}>Operation:</span>
          <Text className={classes.value}>
            {operationName}{" "}
            {isOptimistic && (
              <Badge size="small" appearance="filled" color="brand">
                Optimistic
              </Badge>
            )}
          </Text>
        </div>
      )}
      {hasVariables && (
        <div className={classes.metaItem}>
          <span className={classes.label}>Variables:</span>
          {shouldInlineVariables ? (
            <Text className={classes.inlineVariables}>{variablesString}</Text>
          ) : (
            <CodeBlock value={variables} language="json" maxHeight="200px" />
          )}
        </div>
      )}
    </div>
  );
};
