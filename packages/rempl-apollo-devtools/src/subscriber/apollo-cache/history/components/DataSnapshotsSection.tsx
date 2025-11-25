import React, { useState } from "react";
import { Switch } from "@fluentui/react-components";
import { SectionCard } from "../SectionCard";
import { JsonViewer } from "../shared/components/JsonViewer";
import { DiffViewer } from "../DiffViewer";

interface DataSnapshotsSectionProps {
  updatedValue?: any;
  incomingValue?: any;
  currentValue?: any;
}

export const DataSnapshotsSection: React.FC<DataSnapshotsSectionProps> = ({
  updatedValue,
  incomingValue,
  currentValue,
}) => {
  const [showDiff, setShowDiff] = useState(true);

  const showUpdatedSection = updatedValue !== undefined;
  const showIncomingSection = incomingValue !== undefined;
  const showCurrentSection = currentValue !== undefined;

  if (!showUpdatedSection && !showIncomingSection && !showCurrentSection) {
    return null;
  }

  return (
    <SectionCard
      title="Data Snapshots"
      collapsible={false}
      headerAction={
        showCurrentSection && showUpdatedSection ? (
          <Switch
            checked={showDiff}
            onChange={(e, data) => setShowDiff(data.checked)}
            label="Diff view"
            title="Toggle to view a diff of the current data versus the previous data"
          />
        ) : undefined
      }
    >
      {showUpdatedSection && (
        <SectionCard
          title="Data after update"
          defaultExpanded={true}
          variant="nested"
          isFirstChild={true}
        >
          {showDiff && showCurrentSection && currentValue !== undefined ? (
            <DiffViewer oldValue={currentValue} newValue={updatedValue} />
          ) : (
            <JsonViewer data={updatedValue} />
          )}
        </SectionCard>
      )}

      {showIncomingSection && (
        <SectionCard title="Incoming Data" variant="nested">
          <JsonViewer data={incomingValue} />
        </SectionCard>
      )}

      {showCurrentSection && (
        <SectionCard title="Data before update" variant="nested">
          <JsonViewer data={currentValue} />
        </SectionCard>
      )}
    </SectionCard>
  );
};
