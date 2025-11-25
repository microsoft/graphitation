import React from "react";
import { Text, Button, Title1 } from "@fluentui/react-components";
import { Dismiss20Regular } from "@fluentui/react-icons";
import { useDialogHeaderStyles } from "./DialogHeader.styles";

export interface DialogHeaderProps {
  operationInfo?: {
    name: string;
    variables?: Record<string, unknown>;
  } | null;
  operationKey?: string;
  historyCount?: number;
  totalCount?: number;
  onClose: () => void;
}

export const DialogHeader: React.FC<DialogHeaderProps> = ({
  operationInfo,
  operationKey,
  historyCount = 0,
  totalCount = 0,
  onClose,
}) => {
  const classes = useDialogHeaderStyles();

  const hasVariables =
    operationInfo?.variables && Object.keys(operationInfo.variables).length > 0;

  const titleText =
    historyCount > 0 && totalCount > 0
      ? `Operation History - Last ${historyCount} updates (out of ${totalCount})`
      : "Operation History";

  return (
    <div className={classes.header}>
      <Title1>{titleText}</Title1>
      {operationInfo && (
        <div className={classes.operationRow}>
          <Text className={classes.operationName}>{operationInfo.name}</Text>
          {hasVariables && (
            <Text className={classes.variables}>
              {JSON.stringify(operationInfo.variables)}
            </Text>
          )}
        </div>
      )}
      {operationKey && !operationInfo && (
        <Text className={classes.operationKey}>{operationKey}</Text>
      )}
      <Button
        appearance="transparent"
        onClick={onClose}
        className={classes.closeButton}
        icon={<Dismiss20Regular />}
        aria-label="Close"
      />
    </div>
  );
};
