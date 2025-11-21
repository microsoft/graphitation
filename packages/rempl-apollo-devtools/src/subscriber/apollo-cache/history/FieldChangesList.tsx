import React from "react";
import { Text } from "@fluentui/react-components";
import type { FieldChange } from "../../../history/types";
import { useFieldChangesListStyles } from "./FieldChangesList.styles";
import { FieldChangeItem } from "./components/FieldChangeItem";

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
        <FieldChangeItem key={index} change={change} />
      ))}
    </div>
  );
};

