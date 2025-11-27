import React from "react";
import { Tooltip } from "@fluentui/react-components";
import { Info16Regular } from "@fluentui/react-icons";
import type { HistoryChangeSerialized } from "@graphitation/apollo-forest-run";
import { OperationMetadata } from "./components";
import { FieldChangesList } from "./FieldChangesList";
import { SectionCard } from "./SectionCard";
import { useHistoryDetailsStyles } from "./HistoryDetails.styles";
import { MissingFieldsSection } from "./components/MissingFieldsSection";
import { DataSnapshotsSection } from "./components/DataSnapshotsSection";

export interface HistoryDetailsProps {
  entry: HistoryChangeSerialized;
}

export const HistoryDetails: React.FC<HistoryDetailsProps> = ({ entry }) => {
  const classes = useHistoryDetailsStyles();

  const hasOperationName = entry.modifyingOperation.name;
  const hasVariables =
    entry.modifyingOperation.variables &&
    Object.keys(entry.modifyingOperation.variables).length > 0;
  const hasMissingFields =
    entry.kind === "Regular" &&
    entry.missingFields &&
    entry.missingFields.length > 0;

  const data = entry.data;
  const updatedValue = data?.updated;
  const incomingValue = data?.incoming;
  const currentValue = data?.current;

  const fieldChangeCount = entry.changes.length;
  const fieldChangeLabel = `${fieldChangeCount} ${
    fieldChangeCount === 1 ? "change" : "changes"
  }`;

  const isOptimistic = entry.kind === "Optimistic";
  const OptimisticTitle = () => (
    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
      Field Changes
      <Tooltip
        content="Not all changes necessarily were applied to this query's result. For optimistic updates we displaying all changes made in cache not specifically for this query."
        relationship="description"
      >
        <span style={{ display: "inline-flex", cursor: "help" }}>
          <Info16Regular />
        </span>
      </Tooltip>
    </div>
  );

  return (
    <div className={classes.root}>
      <div className={classes.scrollContainer}>
        <div className={classes.contentInner}>
          {/* Header */}
          <div className={classes.tabList}>
            {/* Metadata */}
            <OperationMetadata
              operationName={
                hasOperationName ? entry.modifyingOperation.name : undefined
              }
              variables={
                hasVariables ? entry.modifyingOperation.variables : undefined
              }
              isOptimistic={entry.kind === "Optimistic"}
            />
          </div>

          {hasMissingFields && entry.kind === "Regular" && (
            <MissingFieldsSection missingFields={entry.missingFields} />
          )}

          <SectionCard
            title={isOptimistic ? <OptimisticTitle /> : "Field Changes"}
            badge={fieldChangeLabel}
            defaultExpanded={true}
          >
            <FieldChangesList
              changes={entry.changes}
              isOptimistic={isOptimistic}
            />
          </SectionCard>

          {/* Data Snapshots */}
          <DataSnapshotsSection
            updatedValue={updatedValue}
            incomingValue={incomingValue}
            currentValue={currentValue}
          />
        </div>
      </div>
    </div>
  );
};
