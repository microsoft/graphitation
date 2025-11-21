import React, { useState, useMemo } from "react";
import {
  Switch,
  Text,
  Tooltip,
  mergeClasses,
} from "@fluentui/react-components";
import {
  Warning16Filled,
  ChevronRight20Regular,
  Info16Regular,
} from "@fluentui/react-icons";
import type { HistoryEntry } from "../../../history/types";
import { OperationMetadata, MissingFieldItem } from "./components";
import { FieldChangesList } from "./FieldChangesList";
import { NodeDiffsList } from "./NodeDiffsList";
import { VirtualizedJsonViewer } from "./VirtualizedJsonViewer";
import { DiffViewer } from "./DiffViewer";
import { SectionCard } from "./SectionCard";
import { useHistoryDetailsStyles } from "./HistoryDetails.styles";

export interface HistoryDetailsProps {
  entry: HistoryEntry;
}

export const HistoryDetails: React.FC<HistoryDetailsProps> = ({ entry }) => {
  const classes = useHistoryDetailsStyles();
  const [showDiff, setShowDiff] = useState(true);
  const [isMissingExpanded, setIsMissingExpanded] = useState(true);

  const hasOperationName = entry.modifyingOperation.name;
  const hasVariables =
    entry.modifyingOperation.variables &&
    Object.keys(entry.modifyingOperation.variables).length > 0;
  const hasMissingFields =
    entry.kind === "Regular" &&
    entry.missingFields &&
    entry.missingFields.length > 0;
  const missingFieldsCount = useMemo(() => {
    if (!hasMissingFields) {
      return 0;
    }

    return (entry as any).missingFields!.reduce(
      (acc: any, item: any) => acc + item.fields.length,
      0,
    );
  }, [entry, hasMissingFields]);

  const missingObjectsCount = hasMissingFields
    ? (entry as any).missingFields!.length
    : 0;

  const data = entry.data;
  const updatedValue = data?.updated;
  const incomingValue = data?.incoming;
  const currentValue = data?.current;

  const showUpdatedSection =
    entry.kind === "Regular" && updatedValue !== undefined;
  const showIncomingSection = incomingValue !== undefined;
  const showCurrentSection = currentValue !== undefined;
  const hasDataSnapshots =
    showUpdatedSection || showIncomingSection || showCurrentSection;
  const fieldChangeCount = entry.kind === "Regular" ? entry.changes.length : 0;
  const fieldChangeLabel = `${fieldChangeCount} ${
    fieldChangeCount === 1 ? "change" : "changes"
  }`;
  const nodeDiffCount =
    entry.kind === "Optimistic" ? entry.nodeDiffs.length : 0;
  const nodeDiffLabel = `${nodeDiffCount} ${
    nodeDiffCount === 1 ? "node difference" : "node differences"
  }`;

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

          {hasMissingFields && (
            <div className={classes.warningBanner} role="alert">
              <button
                type="button"
                className={classes.warningBannerToggle}
                onClick={() => setIsMissingExpanded((prev) => !prev)}
                aria-expanded={isMissingExpanded}
              >
                <div className={classes.warningBannerHeader}>
                  <div className={classes.warningBannerHeaderLeft}>
                    <Warning16Filled className={classes.warningIcon} />
                    <Tooltip
                      content="If an operation reads missing data it will trigger a refetch"
                      relationship="description"
                    >
                      <Text weight="semibold">
                        {missingFieldsCount} missing field
                        {missingFieldsCount === 1 ? "" : "s"} across{" "}
                        {missingObjectsCount} object
                        {missingObjectsCount === 1 ? "" : "s"}
                      </Text>
                    </Tooltip>
                  </div>
                  <ChevronRight20Regular
                    className={mergeClasses(
                      classes.warningChevron,
                      isMissingExpanded && classes.warningChevronExpanded,
                    )}
                  />
                </div>
              </button>

              {isMissingExpanded && (
                <div className={classes.warningBannerContent}>
                  <div className={classes.missingFieldsSection}>
                    {entry.missingFields!.map((missing, idx) => (
                      <MissingFieldItem key={idx} missing={missing} />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Changes or Node Diffs */}
          {entry.kind === "Regular" ? (
            <SectionCard
              title="Field Changes"
              badge={fieldChangeLabel}
              defaultExpanded={true}
            >
              <FieldChangesList changes={entry.changes} />
            </SectionCard>
          ) : (
            <SectionCard
              title={
                <div
                  style={{ display: "flex", alignItems: "center", gap: "8px" }}
                >
                  Node Differences
                  <Tooltip
                    content="Optimistic updates may contain changes that are not fully applied to the cache if they don't match the query structure."
                    relationship="description"
                  >
                    <span style={{ display: "inline-flex", cursor: "help" }}>
                      <Info16Regular />
                    </span>
                  </Tooltip>
                </div>
              }
              badge={nodeDiffLabel}
              defaultExpanded={true}
            >
              <NodeDiffsList nodeDiffs={entry.nodeDiffs} />
            </SectionCard>
          )}

          {/* Data Snapshots */}
          {hasDataSnapshots && (
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
                  {updatedValue !== undefined && (
                    <>
                      {showDiff &&
                      showCurrentSection &&
                      currentValue !== undefined ? (
                        <DiffViewer
                          oldValue={currentValue}
                          newValue={updatedValue}
                        />
                      ) : (
                        <VirtualizedJsonViewer data={updatedValue} />
                      )}
                    </>
                  )}
                </SectionCard>
              )}

              {showIncomingSection && (
                <SectionCard title="Incoming Data" variant="nested">
                  {incomingValue !== undefined && (
                    <VirtualizedJsonViewer data={incomingValue} />
                  )}
                </SectionCard>
              )}

              {showCurrentSection && (
                <SectionCard title="Data before update" variant="nested">
                  {currentValue !== undefined && (
                    <VirtualizedJsonViewer data={currentValue} />
                  )}
                </SectionCard>
              )}
            </SectionCard>
          )}
        </div>
      </div>
    </div>
  );
};
