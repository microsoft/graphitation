import React, { useState } from "react";
import { Switch } from "@fluentui/react-components";
import type { HistoryEntry } from "../../../history/types";
import { CollapsibleSection, usePanelStyles } from "./shared";
import { useCollapsibleSections } from "./hooks";
import { OperationMetadata, MissingFieldItem } from "./components";
import { FieldChangesList } from "./FieldChangesList";
import { NodeDiffsList } from "./NodeDiffsList";
import { VirtualizedJsonViewer } from "./VirtualizedJsonViewer";
import { DiffViewer } from "./DiffViewer";
import { useHistoryDetailsStyles } from "./HistoryDetails.styles";

export interface HistoryDetailsProps {
  entry: HistoryEntry;
}

export const HistoryDetails: React.FC<HistoryDetailsProps> = ({ entry }) => {
  const classes = useHistoryDetailsStyles();
  const [showDiff, setShowDiff] = useState(false);
  const { isExpanded, toggle } = useCollapsibleSections({
    initialExpanded: ["changes", "nodeDiffs"],
  });

  const hasOperationName = entry.modifyingOperation.name;
  const hasVariables =
    entry.modifyingOperation.variables &&
    Object.keys(entry.modifyingOperation.variables).length > 0;
  const hasMissingFields =
    entry.missingFields && entry.missingFields.length > 0;

  return (
    <div className={classes.root}>
      <div className={classes.scrollContainer}>
        <div className={classes.content}>
          {/* Header */}
          <div className={classes.header}>
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

          {/* Changes or Node Diffs */}
          {entry.kind === "Regular" ? (
            <div className={classes.section}>
              <CollapsibleSection
                title={`Field Changes (${entry.changes.length})`}
                isExpanded={isExpanded("changes")}
                onToggle={() => toggle("changes")}
              >
                <FieldChangesList changes={entry.changes} />
              </CollapsibleSection>
            </div>
          ) : (
            <div className={classes.section}>
              <CollapsibleSection
                title={`Node Differences (${entry.nodeDiffs.length})`}
                isExpanded={isExpanded("nodeDiffs")}
                onToggle={() => toggle("nodeDiffs")}
              >
                <NodeDiffsList nodeDiffs={entry.nodeDiffs} />
              </CollapsibleSection>
            </div>
          )}

          {/* Data Snapshots */}
          {entry.data && (
            <>
              {/* Updated/New State (Regular only) - FIRST */}
              {entry.kind === "Regular" && entry.data.updated !== undefined && (
                <div className={classes.section}>
                  <div className={classes.sectionHeaderWithSwitch}>
                    <div
                      className={classes.sectionHeaderLeft}
                      onClick={() => toggle("updated")}
                    >
                      <CollapsibleSection
                        title="New State"
                        isExpanded={isExpanded("updated")}
                        onToggle={() => toggle("updated")}
                        renderHeaderOnly
                      >
                        {null}
                      </CollapsibleSection>
                    </div>
                    {entry.data.current !== undefined && (
                      <Switch
                        checked={showDiff}
                        onChange={(e, data) => setShowDiff(data.checked)}
                        label="Show Diff"
                      />
                    )}
                  </div>
                  {isExpanded("updated") && (
                    <div>
                      {showDiff && entry.data.current !== undefined ? (
                        <DiffViewer
                          oldValue={entry.data.current}
                          newValue={entry.data.updated}
                        />
                      ) : (
                        <VirtualizedJsonViewer data={entry.data.updated} />
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Incoming Data - SECOND */}
              {entry.data.incoming !== undefined && (
                <div className={classes.section}>
                  <CollapsibleSection
                    title="Incoming Data"
                    isExpanded={isExpanded("incoming")}
                    onToggle={() => toggle("incoming")}
                  >
                    <VirtualizedJsonViewer data={entry.data.incoming} />
                  </CollapsibleSection>
                </div>
              )}

              {/* Previous State - THIRD */}
              {entry.data.current !== undefined && (
                <div className={classes.section}>
                  <CollapsibleSection
                    title="Previous State"
                    isExpanded={isExpanded("current")}
                    onToggle={() => toggle("current")}
                  >
                    <VirtualizedJsonViewer data={entry.data.current} />
                  </CollapsibleSection>
                </div>
              )}
            </>
          )}

          {/* Missing Fields Warning */}
          {hasMissingFields && (
            <div className={classes.section}>
              <CollapsibleSection
                title={`⚠️ Missing Fields (${
                  entry.missingFields!.length
                } objects)`}
                isExpanded={isExpanded("missing")}
                onToggle={() => toggle("missing")}
              >
                <div className={classes.missingFieldsSection}>
                  {entry.missingFields!.map((missing, idx) => (
                    <MissingFieldItem key={idx} missing={missing} />
                  ))}
                </div>
              </CollapsibleSection>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
