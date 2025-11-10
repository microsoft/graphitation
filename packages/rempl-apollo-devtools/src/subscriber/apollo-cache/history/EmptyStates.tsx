import React from "react";
import {
  makeStyles,
  shorthands,
  tokens,
  Text,
} from "@fluentui/react-components";
import type { HistoryEntry } from "../../../history/types";

const useStyles = makeStyles({
  container: {
    ...shorthands.padding(
      tokens.spacingVerticalXXXL,
      tokens.spacingHorizontalXXL,
    ),
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    minHeight: "400px",
    textAlign: "center",
  },
  icon: {
    fontSize: "48px",
    marginBottom: tokens.spacingVerticalL,
    opacity: 0.3,
  },
  title: {
    color: tokens.colorNeutralForeground2,
    marginBottom: tokens.spacingVerticalS,
  },
  description: {
    color: tokens.colorNeutralForeground3,
    maxWidth: "400px",
  },
});

interface EmptyHistoryStateProps {
  operationKey?: string;
}

export const EmptyHistoryState: React.FC<EmptyHistoryStateProps> = ({
  operationKey,
}) => {
  const classes = useStyles();

  return (
    <div className={classes.container}>
      <div className={classes.icon}>📋</div>
      <Text size={500} weight="semibold" className={classes.title}>
        No History Available
      </Text>
      <Text size={300} className={classes.description}>
        {operationKey
          ? "No history entries found for this operation. History tracking may not be enabled or no changes have been recorded yet."
          : "Select an operation from the cache to view its history."}
      </Text>
    </div>
  );
};

interface LoadingHistoryStateProps {
  operationKey?: string;
}

export const LoadingHistoryState: React.FC<LoadingHistoryStateProps> = ({
  operationKey,
}) => {
  const classes = useStyles();

  return (
    <div className={classes.container}>
      <div className={classes.icon}>⏳</div>
      <Text size={500} weight="semibold" className={classes.title}>
        Loading History...
      </Text>
      <Text size={300} className={classes.description}>
        Fetching history entries for {operationKey || "the operation"}
      </Text>
    </div>
  );
};

interface EmptySelectionStateProps {}

export const EmptySelectionState: React.FC<EmptySelectionStateProps> = () => {
  const classes = useStyles();

  return (
    <div className={classes.container}>
      <div className={classes.icon}>👈</div>
      <Text size={500} weight="semibold" className={classes.title}>
        Select an Entry
      </Text>
      <Text size={300} className={classes.description}>
        Choose an entry from the timeline to view its details, changes, and
        data.
      </Text>
    </div>
  );
};
