import React, { useState } from "react";
import {
  makeStyles,
  shorthands,
  tokens,
  Text,
  Button,
  Switch,
  Label,
  mergeClasses,
} from "@fluentui/react-components";
import { ChevronRight20Regular } from "@fluentui/react-icons";
import type { HistoryEntry, MissingFieldInfo } from "../../../history/types";
import { FieldChangesList } from "./FieldChangesList";
import { NodeDiffsList } from "./NodeDiffsList";
import { DiffViewer } from "./DiffViewer";
import { VirtualizedJsonViewer } from "./VirtualizedJsonViewer";

const useStyles = makeStyles({
  container: {
    ...shorthands.padding(tokens.spacingVerticalM, tokens.spacingHorizontalL),
    overflowY: "auto",
    height: "100%",
  },
  content: {
    display: "flex",
    flexDirection: "column",
    ...shorthands.gap(tokens.spacingVerticalL),
  },
  header: {
    ...shorthands.padding(tokens.spacingVerticalM, tokens.spacingHorizontalM),
    backgroundColor: tokens.colorNeutralBackground2,
    ...shorthands.borderRadius(tokens.borderRadiusMedium),
    ...shorthands.border(
      tokens.strokeWidthThin,
      "solid",
      tokens.colorNeutralStroke2,
    ),
  },
  headerTitle: {
    display: "flex",
    alignItems: "center",
    ...shorthands.gap(tokens.spacingHorizontalS),
    marginBottom: tokens.spacingVerticalXS,
  },
  optimisticBadge: {
    ...shorthands.padding(tokens.spacingVerticalXXS, tokens.spacingHorizontalS),
    backgroundColor: "rgba(0, 120, 212, 0.2)",
    color: tokens.colorBrandForeground1,
    ...shorthands.borderRadius(tokens.borderRadiusSmall),
    fontSize: tokens.fontSizeBase200,
    fontWeight: tokens.fontWeightSemibold,
  },
  timestamp: {
    color: tokens.colorNeutralForeground3,
    fontFamily: tokens.fontFamilyMonospace,
    fontSize: tokens.fontSizeBase200,
  },
  variablesBox: {
    marginTop: tokens.spacingVerticalS,
    ...shorthands.padding(tokens.spacingVerticalS, tokens.spacingHorizontalS),
    backgroundColor: tokens.colorNeutralBackground2,
    ...shorthands.borderRadius(tokens.borderRadiusMedium),
  },
  variablesLabel: {
    marginBottom: tokens.spacingVerticalXS,
  },
  codeBlock: {
    fontFamily: tokens.fontFamilyMonospace,
    fontSize: tokens.fontSizeBase200,
    ...shorthands.padding(tokens.spacingVerticalS, tokens.spacingHorizontalS),
    backgroundColor: tokens.colorNeutralBackground3,
    ...shorthands.borderRadius(tokens.borderRadiusMedium),
    ...shorthands.overflow("auto"),
    maxHeight: "400px",
    ...shorthands.border(
      tokens.strokeWidthThin,
      "solid",
      tokens.colorNeutralStroke2,
    ),
  },
  section: {
    display: "flex",
    flexDirection: "column",
  },
  sectionHeader: {
    justifyContent: "flex-start",
    ...shorthands.padding(tokens.spacingVerticalS, 0),
    width: "100%",
    ...shorthands.gap(tokens.spacingHorizontalS),
    marginBottom: tokens.spacingVerticalS,
  },
  sectionHeaderWithSwitch: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: tokens.spacingVerticalS,
  },
  sectionHeaderLeft: {
    display: "flex",
    alignItems: "center",
    ...shorthands.gap(tokens.spacingHorizontalS),
    cursor: "pointer",
    ...shorthands.flex(1),
  },
  chevron: {
    ...shorthands.transition("transform", "0.2s"),
  },
  chevronExpanded: {
    transform: "rotate(90deg)",
  },
  sectionContent: {
    ...shorthands.padding(tokens.spacingVerticalS, 0),
  },
  missingFieldsSection: {
    ...shorthands.padding(tokens.spacingVerticalM, tokens.spacingHorizontalM),
    backgroundColor: "rgba(255, 200, 100, 0.1)",
    ...shorthands.borderRadius(tokens.borderRadiusMedium),
    ...shorthands.border(
      tokens.strokeWidthThin,
      "solid",
      "rgba(255, 200, 100, 0.4)",
    ),
  },
  missingFieldItem: {
    ...shorthands.padding(tokens.spacingVerticalS, tokens.spacingHorizontalM),
    marginTop: tokens.spacingVerticalS,
    backgroundColor: tokens.colorNeutralBackground1,
    ...shorthands.borderRadius(tokens.borderRadiusMedium),
  },
  missingFieldsList: {
    display: "flex",
    flexWrap: "wrap",
    ...shorthands.gap(tokens.spacingHorizontalS),
    marginTop: tokens.spacingVerticalXS,
  },
  missingFieldChip: {
    ...shorthands.padding(tokens.spacingVerticalXXS, tokens.spacingHorizontalS),
    backgroundColor: tokens.colorPaletteYellowBackground1,
    ...shorthands.borderRadius(tokens.borderRadiusMedium),
    ...shorthands.border(
      tokens.strokeWidthThin,
      "solid",
      tokens.colorPaletteYellowBorder2,
    ),
    fontFamily: tokens.fontFamilyMonospace,
    fontSize: tokens.fontSizeBase200,
  },
  toggleContainer: {
    display: "flex",
    alignItems: "center",
    ...shorthands.gap(tokens.spacingHorizontalS),
    marginBottom: tokens.spacingVerticalS,
    ...shorthands.padding(tokens.spacingVerticalS, tokens.spacingHorizontalS),
    backgroundColor: tokens.colorNeutralBackground2,
    ...shorthands.borderRadius(tokens.borderRadiusMedium),
  },
});

interface HistoryDetailsProps {
  entry: HistoryEntry;
}

export const HistoryDetails: React.FC<HistoryDetailsProps> = ({ entry }) => {
  const classes = useStyles();
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set(["changes", "nodeDiffs"]),
  );
  const [showDiff, setShowDiff] = useState(false);

  const toggleSection = (section: string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(section)) {
        next.delete(section);
      } else {
        next.add(section);
      }
      return next;
    });
  };

  const hasVariables =
    entry.modifyingOperation?.variables &&
    Object.keys(entry.modifyingOperation.variables).length > 0;

  const hasMissingFields =
    entry.missingFields && entry.missingFields.length > 0;

  return (
    <div className={classes.container}>
      <div className={classes.content}>
        {/* Header */}
        <div className={classes.header}>
          <div className={classes.headerTitle}>
            <Text size={500} weight="semibold">
              {entry.modifyingOperation?.name || "Anonymous Operation"}
            </Text>
            {entry.kind === "Optimistic" && (
              <span className={classes.optimisticBadge}>Optimistic</span>
            )}
          </div>
          <Text className={classes.timestamp}>
            {new Date(entry.timestamp).toLocaleString()}
          </Text>
          {hasVariables && (
            <div className={classes.variablesBox}>
              <Text
                size={300}
                weight="semibold"
                className={classes.variablesLabel}
              >
                Variables:
              </Text>
              <pre className={classes.codeBlock}>
                {JSON.stringify(entry.modifyingOperation.variables, null, 2)}
              </pre>
            </div>
          )}
        </div>

        {/* Changes or Node Diffs */}
        {entry.kind === "Regular" ? (
          <div className={classes.section}>
            <Button
              appearance="transparent"
              onClick={() => toggleSection("changes")}
              className={classes.sectionHeader}
            >
              <ChevronRight20Regular
                className={mergeClasses(
                  classes.chevron,
                  expandedSections.has("changes") && classes.chevronExpanded,
                )}
              />
              <Text size={400} weight="semibold">
                Field Changes ({entry.changes.length})
              </Text>
            </Button>
            {expandedSections.has("changes") && (
              <div className={classes.sectionContent}>
                <FieldChangesList changes={entry.changes} />
              </div>
            )}
          </div>
        ) : (
          <div className={classes.section}>
            <Button
              appearance="transparent"
              onClick={() => toggleSection("nodeDiffs")}
              className={classes.sectionHeader}
            >
              <ChevronRight20Regular
                className={mergeClasses(
                  classes.chevron,
                  expandedSections.has("nodeDiffs") && classes.chevronExpanded,
                )}
              />
              <Text size={400} weight="semibold">
                Node Differences ({entry.nodeDiffs.length})
              </Text>
            </Button>
            {expandedSections.has("nodeDiffs") && (
              <div className={classes.sectionContent}>
                <NodeDiffsList nodeDiffs={entry.nodeDiffs} />
              </div>
            )}
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
                    onClick={() => toggleSection("updated")}
                  >
                    <ChevronRight20Regular
                      className={mergeClasses(
                        classes.chevron,
                        expandedSections.has("updated") &&
                          classes.chevronExpanded,
                      )}
                    />
                    <Text size={400} weight="semibold">
                      New State
                    </Text>
                  </div>
                  {entry.data.current !== undefined && (
                    <Switch
                      checked={showDiff}
                      onChange={(e, data) => setShowDiff(data.checked)}
                      label="Show Diff"
                    />
                  )}
                </div>
                {expandedSections.has("updated") && (
                  <div className={classes.sectionContent}>
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
                <Button
                  appearance="transparent"
                  onClick={() => toggleSection("incoming")}
                  className={classes.sectionHeader}
                >
                  <ChevronRight20Regular
                    className={mergeClasses(
                      classes.chevron,
                      expandedSections.has("incoming") &&
                        classes.chevronExpanded,
                    )}
                  />
                  <Text size={400} weight="semibold">
                    Incoming Data
                  </Text>
                </Button>
                {expandedSections.has("incoming") && (
                  <div className={classes.sectionContent}>
                    <VirtualizedJsonViewer data={entry.data.incoming} />
                  </div>
                )}
              </div>
            )}

            {/* Previous State - THIRD */}
            {entry.data.current !== undefined && (
              <div className={classes.section}>
                <Button
                  appearance="transparent"
                  onClick={() => toggleSection("current")}
                  className={classes.sectionHeader}
                >
                  <ChevronRight20Regular
                    className={mergeClasses(
                      classes.chevron,
                      expandedSections.has("current") &&
                        classes.chevronExpanded,
                    )}
                  />
                  <Text size={400} weight="semibold">
                    Previous State
                  </Text>
                </Button>
                {expandedSections.has("current") && (
                  <div className={classes.sectionContent}>
                    <VirtualizedJsonViewer data={entry.data.current} />
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {/* Missing Fields Warning */}
        {hasMissingFields && (
          <div className={classes.section}>
            <Button
              appearance="transparent"
              onClick={() => toggleSection("missing")}
              className={classes.sectionHeader}
            >
              <ChevronRight20Regular
                className={mergeClasses(
                  classes.chevron,
                  expandedSections.has("missing") && classes.chevronExpanded,
                )}
              />
              <Text size={400} weight="semibold">
                ⚠️ Missing Fields ({entry.missingFields!.length} objects)
              </Text>
            </Button>
            {expandedSections.has("missing") && (
              <div className={classes.sectionContent}>
                <div className={classes.missingFieldsSection}>
                  {entry.missingFields!.map((missing, idx) => (
                    <MissingFieldItem
                      key={idx}
                      missing={missing}
                      classes={classes}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

interface MissingFieldItemProps {
  missing: MissingFieldInfo;
  classes: ReturnType<typeof useStyles>;
}

const MissingFieldItem: React.FC<MissingFieldItemProps> = ({
  missing,
  classes,
}) => {
  return (
    <div className={classes.missingFieldItem}>
      <Text weight="semibold" size={300}>
        {missing.objectIdentifier}
      </Text>
      <div className={classes.missingFieldsList}>
        {missing.fields.map((field, idx) => (
          <span key={idx} className={classes.missingFieldChip}>
            {field.name}
          </span>
        ))}
      </div>
    </div>
  );
};
