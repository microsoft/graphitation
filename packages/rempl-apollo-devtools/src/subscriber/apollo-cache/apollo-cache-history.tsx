import React, { useMemo, useState, useEffect, useContext } from "react";
import { useStyles } from "./apollo-cache-history.styles";
import {
  Button,
  Text,
  Title1,
  Title3,
  Switch,
  mergeClasses,
} from "@fluentui/react-components";
import { Dismiss20Regular, ChevronRight20Regular } from "@fluentui/react-icons";
import { CacheObjectWithSize } from "./types";
import { ApolloCacheContext } from "../contexts/apollo-cache-context";

interface HistoryEntry {
  timestamp: number;
  operationName: string;
  variables: Record<string, unknown>;
  changes: Array<{
    kind: number; // 0=Replacement, 1=Filler, 3=CompositeListDifference
    path: ReadonlyArray<string | number>;
    fieldInfo?: { name: string; dataKey: string };
    oldValue?: any;
    newValue?: any;
    itemChanges?: any[];
    index?: number;
    data?: any;
    missingFields?: any;
  }>;
  missingFields?: Array<{
    objectIdentifier: string;
    fields: Array<{ name: string; dataKey: string }>;
  }>;
  current: {
    result: any;
  };
  incoming: {
    result?: any;
    operation?: any;
  };
  updated: {
    result: any;
    changes: any[];
  };
}

interface ApolloCacheHistoryProps {
  item: CacheObjectWithSize | undefined;
  onClose: () => void;
}

export const ApolloCacheHistory = React.memo(
  ({ item, onClose }: ApolloCacheHistoryProps) => {
    const classes = useStyles();
    const [selectedEntryIndex, setSelectedEntryIndex] = useState<number | null>(
      null,
    );
    const [history, setHistory] = useState<HistoryEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const cacheContext = useContext(ApolloCacheContext);

    // Stabilize the getOperationHistory function reference
    const getOperationHistory = useMemo(
      () => cacheContext?.getOperationHistory,
      [cacheContext?.getOperationHistory],
    );

    // Fetch history on-demand from the publisher (only when item.key changes)
    useEffect(() => {
      const fetchHistory = async () => {
        if (!item?.key || !getOperationHistory) {
          setHistory([]);
          setLoading(false);
          return;
        }

        console.log("[Subscriber] Fetching history for:", item.key);
        setLoading(true);
        try {
          const fetchedHistory = await getOperationHistory(item.key);

          if (fetchedHistory && Array.isArray(fetchedHistory)) {
            console.log("[Subscriber] Received history:", fetchedHistory);
            console.log(
              "[Subscriber] First entry changes:",
              fetchedHistory[0]?.changes,
            );
            setHistory(fetchedHistory as HistoryEntry[]);
          } else {
            setHistory([]);
          }
        } catch (e) {
          setHistory([]);
        } finally {
          setLoading(false);
        }
      };

      fetchHistory();
    }, [item?.key, getOperationHistory]);

    const selectedEntry = useMemo(() => {
      if (selectedEntryIndex === null || !history[selectedEntryIndex]) {
        return null;
      }
      return history[selectedEntryIndex];
    }, [selectedEntryIndex, history]);

    if (loading) {
      return (
        <div className={classes.root} onClick={() => onClose()}>
          <div
            className={classes.dialogContainer}
            onClick={(e) => e.stopPropagation()}
          >
            <div className={classes.header}>
              <Title1>Loading History...</Title1>
              <Button
                appearance="transparent"
                onClick={() => onClose()}
                className={classes.closeButton}
                icon={<Dismiss20Regular />}
              />
            </div>
            <Text className={classes.noHistory}>
              Fetching operation history...
            </Text>
          </div>
        </div>
      );
    }

    return (
      <div className={classes.root} onClick={() => onClose()}>
        <div
          className={classes.dialogContainer}
          onClick={(e) => e.stopPropagation()}
        >
          <div className={classes.header}>
            <div className={classes.headerContent}>
              <Title1>Operation History: {item?.key}</Title1>
              {history.length > 0 && history[0]?.incoming?.operation && (
                <div className={classes.operationMetadata}>
                  <Text size={300} weight="semibold">
                    {history[0].incoming.operation.definition?.name?.value ||
                      "Anonymous Operation"}
                  </Text>
                  {history[0].incoming.operation.variables &&
                    Object.keys(history[0].incoming.operation.variables)
                      .length > 0 && (
                      <Text size={200} className={classes.operationVariables}>
                        Variables:{" "}
                        {JSON.stringify(
                          history[0].incoming.operation.variables,
                        )}
                      </Text>
                    )}
                </div>
              )}
            </div>
            <Button
              appearance="transparent"
              onClick={() => onClose()}
              className={classes.closeButton}
              icon={<Dismiss20Regular />}
            />
          </div>

          <div className={classes.contentContainer}>
            {/* Timeline sidebar */}
            <div className={classes.timeline}>
              <Title3 className={classes.sectionTitle}>
                Timeline ({history.length} entries)
              </Title3>
              <div className={classes.timelineList}>
                {history.map((entry, index) => {
                  const hasIncompleteData =
                    entry.missingFields && entry.missingFields.length > 0;
                  const missingFieldsCount = hasIncompleteData
                    ? entry.missingFields!.reduce(
                        (sum, mf) => sum + mf.fields.length,
                        0,
                      )
                    : 0;
                  const changeCount = entry.changes?.length || 0;
                  return (
                    <div
                      key={index}
                      className={mergeClasses(
                        classes.timelineItem,
                        selectedEntryIndex === index &&
                          classes.timelineItemActive,
                        hasIncompleteData && classes.timelineItemIncomplete,
                      )}
                      onClick={() => setSelectedEntryIndex(index)}
                    >
                      <Text weight="semibold" size={300}>
                        Update #{index + 1}
                      </Text>
                      <Text size={200} className={classes.timelineItemTime}>
                        {new Date(entry.timestamp).toLocaleTimeString()}
                      </Text>
                      <Text size={200} className={classes.operationName}>
                        {entry.operationName || "Anonymous Operation"}
                      </Text>
                      {changeCount > 0 && (
                        <Text size={100} className={classes.changeCountTag}>
                          {changeCount} changes
                        </Text>
                      )}
                      {hasIncompleteData && (
                        <Text size={100} className={classes.missingFieldsTag}>
                          {missingFieldsCount} missing fields
                        </Text>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Details panel */}
            <div className={classes.detailsPanel}>
              {selectedEntry ? (
                <HistoryDetails entry={selectedEntry} classes={classes} />
              ) : (
                <div className={classes.emptyState}>
                  <Text>Select an entry from the timeline to view details</Text>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  },
);

interface HistoryDetailsProps {
  entry: HistoryEntry;
  classes: ReturnType<typeof useStyles>;
}

const HistoryDetails = React.memo(({ entry, classes }: HistoryDetailsProps) => {
  const [expandedSections, setExpandedSections] = useState<
    Set<"changes" | "current" | "incoming" | "updated" | "missing">
  >(new Set(["changes"]));

  const toggleSection = (
    section: "changes" | "current" | "incoming" | "updated" | "missing",
  ) => {
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

  const changes = useMemo(() => {
    console.log("[Subscriber] Extracting changes from:", entry.changes);
    const result = extractChangesFromFlat(entry.changes || []);
    console.log("[Subscriber] Extracted changes:", result);
    return result;
  }, [entry]);

  return (
    <div className={classes.detailsContent}>
      {/* Operation Header */}
      <div className={classes.operationHeader}>
        <div className={classes.operationTitle}>
          <Text size={400} weight="semibold">
            {entry.operationName || "Anonymous Operation"}
          </Text>
          <Text size={200} className={classes.operationTimestamp}>
            {new Date(entry.timestamp).toLocaleString()}
          </Text>
        </div>
        {entry.variables && Object.keys(entry.variables).length > 0 && (
          <div className={classes.operationVariablesBox}>
            <Text size={200} weight="semibold">
              Variables:
            </Text>
            <pre className={classes.variablesCode}>
              {JSON.stringify(entry.variables, null, 2)}
            </pre>
          </div>
        )}
      </div>

      {/* Changes Section */}
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
          <Title3>
            Changes ({changes.fieldChanges.length} field changes,{" "}
            {changes.listChanges.length} list changes)
          </Title3>
        </Button>
        {expandedSections.has("changes") && (
          <div className={classes.sectionContent}>
            {changes.fieldChanges.length > 0 && (
              <div className={classes.changesGroup}>
                <Text weight="semibold" size={300}>
                  Field Changes:
                </Text>
                {changes.fieldChanges.map((change, idx) => (
                  <FieldChangeItem
                    key={idx}
                    change={change}
                    classes={classes}
                  />
                ))}
              </div>
            )}
            {changes.listChanges.length > 0 && (
              <div className={classes.changesGroup}>
                <Text weight="semibold" size={300}>
                  List Changes:
                </Text>
                {changes.listChanges.map((change, idx) => (
                  <ListChangeItem key={idx} change={change} classes={classes} />
                ))}
              </div>
            )}
            {changes.fieldChanges.length === 0 &&
              changes.listChanges.length === 0 && (
                <Text size={200} className={classes.noChanges}>
                  No detailed changes recorded
                </Text>
              )}
          </div>
        )}
      </div>

      {/* New State Section with Diff Toggle */}
      <div className={classes.section}>
        <Button
          appearance="transparent"
          onClick={() => toggleSection("updated")}
          className={classes.sectionHeader}
        >
          <ChevronRight20Regular
            className={mergeClasses(
              classes.chevron,
              expandedSections.has("updated") && classes.chevronExpanded,
            )}
          />
          <Title3>New State</Title3>
        </Button>
        {expandedSections.has("updated") && (
          <div className={classes.sectionContent}>
            <DiffViewer
              oldData={entry.current.result}
              newData={entry.updated.result}
              classes={classes}
            />
          </div>
        )}
      </div>

      {/* Incoming Data Section */}
      {entry.incoming?.result && (
        <div className={classes.section}>
          <Button
            appearance="transparent"
            onClick={() => toggleSection("incoming")}
            className={classes.sectionHeader}
          >
            <ChevronRight20Regular
              className={mergeClasses(
                classes.chevron,
                expandedSections.has("incoming") && classes.chevronExpanded,
              )}
            />
            <Title3>Incoming Data</Title3>
          </Button>
          {expandedSections.has("incoming") && (
            <div className={classes.sectionContent}>
              <pre className={classes.codeBlock}>
                {JSON.stringify(entry.incoming.result, null, 2)}
              </pre>
            </div>
          )}
        </div>
      )}

      {/* Previous State Section */}
      <div className={classes.section}>
        <Button
          appearance="transparent"
          onClick={() => toggleSection("current")}
          className={classes.sectionHeader}
        >
          <ChevronRight20Regular
            className={mergeClasses(
              classes.chevron,
              expandedSections.has("current") && classes.chevronExpanded,
            )}
          />
          <Title3>Previous State</Title3>
        </Button>
        {expandedSections.has("current") && (
          <div className={classes.sectionContent}>
            <pre className={classes.codeBlock}>
              {JSON.stringify(entry.current.result, null, 2)}
            </pre>
          </div>
        )}
      </div>

      {/* Missing Fields Section (Tree-level) */}
      {entry.missingFields && entry.missingFields.length > 0 && (
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
            <Title3 className={classes.missingSectionTitle}>
              ⚠️ Missing Fields ({entry.missingFields.length} objects)
            </Title3>
          </Button>
          {expandedSections.has("missing") && (
            <div className={classes.sectionContent}>
              {entry.missingFields.map((missing, idx) => (
                <div key={idx} className={classes.missingFieldsItem}>
                  <Text weight="semibold" size={200}>
                    {missing.objectIdentifier}
                  </Text>
                  <div className={classes.missingFieldsList}>
                    {missing.fields.map((field, fieldIdx) => (
                      <div key={fieldIdx} className={classes.missingFieldChip}>
                        <Text size={200} className={classes.missingFieldName}>
                          {field.name}
                        </Text>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
});

interface FieldChangeItemProps {
  change: any;
  classes: ReturnType<typeof useStyles>;
}

const FieldChangeItem = React.memo(
  ({ change, classes }: FieldChangeItemProps) => {
    const [isExpanded, setIsExpanded] = useState(false); // Collapsed by default

    // Generate a preview of the change for the header
    const changePreview = React.useMemo(() => {
      if (change.kind === 0 && change.oldValue !== undefined) {
        // Replacement
        const oldPreview = getValuePreview(change.oldValue);
        const newPreview = getValuePreview(change.newValue);
        return `${oldPreview} → ${newPreview}`;
      } else if (change.kind === 1) {
        // Filler
        const newPreview = getValuePreview(change.newValue);
        return `filled with ${newPreview}`;
      }
      return "";
    }, [change]);

    const fieldPath = change.path?.join(".") || "unknown";
    const fieldName =
      change.fieldInfo?.name ||
      change.path?.[change.path.length - 1] ||
      "unknown";

    const changeTypeLabel =
      change.kind === 0 ? "modified" : change.kind === 1 ? "filled" : "unknown";

    return (
      <div className={classes.changeItemRow}>
        <div
          className={classes.changeItemRowHeader}
          onClick={() => setIsExpanded(!isExpanded)}
        >
          <ChevronRight20Regular
            className={mergeClasses(
              classes.changeRowChevron,
              isExpanded && classes.chevronExpanded,
            )}
          />
          <Text size={200} className={classes.changeFieldName}>
            {fieldPath}
          </Text>
          <Text size={100} className={classes.changeTypeLabel}>
            {changeTypeLabel}
          </Text>
          <Text size={200} className={classes.changePreviewText}>
            {changePreview}
          </Text>
        </div>

        {isExpanded && (
          <div className={classes.changeExpandedContent}>
            {change.kind === 0 && (
              <div className={classes.valueComparisonInline}>
                <div>
                  <Text size={100} className={classes.valueLabel}>
                    Old:
                  </Text>
                  <pre className={classes.valueCodeInline}>
                    {change.oldValue !== undefined
                      ? formatValue(change.oldValue)
                      : "(no old value)"}
                  </pre>
                </div>
                <div>
                  <Text size={100} className={classes.valueLabel}>
                    New:
                  </Text>
                  <pre className={classes.valueCodeInline}>
                    {change.newValue !== undefined
                      ? formatValue(change.newValue)
                      : "(no new value)"}
                  </pre>
                </div>
              </div>
            )}
            {change.kind === 1 && (
              <div>
                <Text size={100} className={classes.valueLabel}>
                  Value:
                </Text>
                <pre className={classes.valueCodeInline}>
                  {change.newValue !== undefined
                    ? formatValue(change.newValue)
                    : "(no value)"}
                </pre>
              </div>
            )}
          </div>
        )}
      </div>
    );
  },
);

interface ListChangeItemProps {
  change: any;
  classes: ReturnType<typeof useStyles>;
}

const ListChangeItem = React.memo(
  ({ change, classes }: ListChangeItemProps) => {
    const [isExpanded, setIsExpanded] = useState(false);

    const fieldPath = change.path?.join(".") || "unknown";
    const itemChangeCount = change.itemChanges?.length || 0;

    return (
      <div className={classes.changeItemRow}>
        <div
          className={classes.changeItemRowHeader}
          onClick={() => setIsExpanded(!isExpanded)}
        >
          <ChevronRight20Regular
            className={mergeClasses(
              classes.changeRowChevron,
              isExpanded && classes.chevronExpanded,
            )}
          />
          <Text size={200} className={classes.changeFieldName}>
            {fieldPath}
          </Text>
          <Text size={100} className={classes.changeTypeLabel}>
            list
          </Text>
          {itemChangeCount > 0 && (
            <Text size={200} className={classes.changePreviewText}>
              {itemChangeCount} item changes
            </Text>
          )}
        </div>

        {isExpanded && (
          <div className={classes.changeExpandedContent}>
            {change.itemChanges && change.itemChanges.length > 0 ? (
              <div>
                {change.itemChanges.map((item: any, idx: number) => (
                  <div key={idx} className={classes.arrayItemRow}>
                    <Text size={200} weight="semibold">
                      {item.kind === 1
                        ? `Item removed (previously at index ${item.oldIndex})`
                        : item.kind === 0
                        ? `Item added at index ${item.index}`
                        : item.kind === 2
                        ? `Item moved from ${item.oldIndex} to ${item.index}`
                        : `Item changed at index ${
                            item.index || item.oldIndex
                          }`}
                    </Text>
                    {item.data && (
                      <pre className={classes.valueCodeInline}>
                        {formatValue(item.data)}
                      </pre>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <Text size={200}>List structure modified (no item details)</Text>
            )}
          </div>
        )}
      </div>
    );
  },
);

interface DiffViewerProps {
  oldData: any;
  newData: any;
  classes: ReturnType<typeof useStyles>;
}

interface DiffLine {
  type: "added" | "deleted" | "modified" | "unchanged";
  lineNumber: number | null;
  prefix: string;
  content: string;
}

const DiffViewer = React.memo(
  ({ oldData, newData, classes }: DiffViewerProps) => {
    const [showDiff, setShowDiff] = useState(false);

    const diffLines = useMemo(() => {
      if (!showDiff) return null;
      return computeDiff(oldData, newData);
    }, [showDiff, oldData, newData]);

    const stats = useMemo(() => {
      if (!diffLines) return { added: 0, deleted: 0, modified: 0 };

      return diffLines.reduce(
        (
          acc: { added: number; deleted: number; modified: number },
          line: DiffLine,
        ) => {
          if (line.type === "added") acc.added++;
          if (line.type === "deleted") acc.deleted++;
          if (line.type === "modified") acc.modified++;
          return acc;
        },
        { added: 0, deleted: 0, modified: 0 },
      );
    }, [diffLines]);

    return (
      <>
        <div className={classes.diffToggle}>
          <Switch
            checked={showDiff}
            onChange={(_, data) => setShowDiff(data.checked)}
            label="Show diff view"
          />
        </div>

        {showDiff ? (
          diffLines && (
            <div className={classes.diffViewerContainer}>
              <div className={classes.diffViewerHeader}>
                <Text weight="semibold">Changes</Text>
                <div className={classes.diffStats}>
                  {stats.added > 0 && (
                    <div className={classes.diffStatItem}>
                      <Text className={classes.diffStatAdded}>
                        +{stats.added}
                      </Text>
                    </div>
                  )}
                  {stats.deleted > 0 && (
                    <div className={classes.diffStatItem}>
                      <Text className={classes.diffStatDeleted}>
                        -{stats.deleted}
                      </Text>
                    </div>
                  )}
                  {stats.modified > 0 && (
                    <div className={classes.diffStatItem}>
                      <Text className={classes.diffStatModified}>
                        ~{stats.modified}
                      </Text>
                    </div>
                  )}
                </div>
              </div>
              <div className={classes.diffViewerContent}>
                {diffLines.map((line: DiffLine, idx: number) => (
                  <div
                    key={idx}
                    className={mergeClasses(
                      classes.diffLine,
                      line.type === "added" && classes.diffLineAdded,
                      line.type === "deleted" && classes.diffLineDeleted,
                      line.type === "modified" && classes.diffLineModified,
                      line.type === "unchanged" && classes.diffLineUnchanged,
                    )}
                  >
                    <span className={classes.diffLineNumber}>
                      {line.lineNumber || ""}
                    </span>
                    <span className={classes.diffLineContent}>
                      {line.prefix}
                      {line.content}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )
        ) : (
          <pre className={classes.codeBlock}>
            {JSON.stringify(newData, null, 2)}
          </pre>
        )}
      </>
    );
  },
);

// Helper functions
function computeDiff(oldData: any, newData: any): DiffLine[] {
  const oldStr = JSON.stringify(oldData, null, 2);
  const newStr = JSON.stringify(newData, null, 2);

  const oldLines = oldStr.split("\n");
  const newLines = newStr.split("\n");

  // Use LCS (Longest Common Subsequence) algorithm to find matching lines
  const lcs = computeLCS(oldLines, newLines);

  const diffLines: DiffLine[] = [];
  let oldIndex = 0;
  let newIndex = 0;
  let lineNumber = 1;

  // Build diff from LCS
  for (const match of lcs) {
    // Add deleted lines (in old but not in match)
    while (oldIndex < match.oldIndex) {
      diffLines.push({
        type: "deleted",
        lineNumber: null,
        prefix: "- ",
        content: oldLines[oldIndex],
      });
      oldIndex++;
    }

    // Add added lines (in new but not in match)
    while (newIndex < match.newIndex) {
      diffLines.push({
        type: "added",
        lineNumber: lineNumber,
        prefix: "+ ",
        content: newLines[newIndex],
      });
      newIndex++;
      lineNumber++;
    }

    // Add unchanged line (in both)
    diffLines.push({
      type: "unchanged",
      lineNumber: lineNumber,
      prefix: "  ",
      content: newLines[match.newIndex],
    });
    oldIndex++;
    newIndex++;
    lineNumber++;
  }

  // Add remaining deleted lines
  while (oldIndex < oldLines.length) {
    diffLines.push({
      type: "deleted",
      lineNumber: null,
      prefix: "- ",
      content: oldLines[oldIndex],
    });
    oldIndex++;
  }

  // Add remaining added lines
  while (newIndex < newLines.length) {
    diffLines.push({
      type: "added",
      lineNumber: lineNumber,
      prefix: "+ ",
      content: newLines[newIndex],
    });
    newIndex++;
    lineNumber++;
  }

  return diffLines;
}

interface LCSMatch {
  oldIndex: number;
  newIndex: number;
}

function computeLCS(oldLines: string[], newLines: string[]): LCSMatch[] {
  const m = oldLines.length;
  const n = newLines.length;

  // Create LCS table
  const lcsTable: number[][] = Array(m + 1)
    .fill(0)
    .map(() => Array(n + 1).fill(0));

  // Fill LCS table
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (oldLines[i - 1] === newLines[j - 1]) {
        lcsTable[i][j] = lcsTable[i - 1][j - 1] + 1;
      } else {
        lcsTable[i][j] = Math.max(lcsTable[i - 1][j], lcsTable[i][j - 1]);
      }
    }
  }

  // Backtrack to find the actual matching lines
  const matches: LCSMatch[] = [];
  let i = m;
  let j = n;

  while (i > 0 && j > 0) {
    if (oldLines[i - 1] === newLines[j - 1]) {
      matches.unshift({ oldIndex: i - 1, newIndex: j - 1 });
      i--;
      j--;
    } else if (lcsTable[i - 1][j] > lcsTable[i][j - 1]) {
      i--;
    } else {
      j--;
    }
  }

  return matches;
}

function extractChangesFromFlat(changes: any[]): {
  fieldChanges: any[];
  listChanges: any[];
} {
  const fieldChanges: any[] = [];
  const listChanges: any[] = [];

  if (!Array.isArray(changes)) {
    return { fieldChanges, listChanges };
  }

  for (const change of changes) {
    // kind: 0 = Replacement, 1 = Filler, 3 = CompositeListDifference
    if (change.kind === 0 || change.kind === 1) {
      // Field-level changes
      fieldChanges.push(change);
    } else if (change.kind === 3) {
      // List changes (CompositeListDifference)
      listChanges.push(change);
    }
  }

  return { fieldChanges, listChanges };
}

function extractChanges(changesMap: any): {
  fieldChanges: any[];
  arrayChanges: any[];
} {
  const fieldChanges: any[] = [];
  const arrayChanges: any[] = [];

  if (!changesMap || typeof changesMap !== "object") {
    return { fieldChanges, arrayChanges };
  }

  // Handle new serialized format: array of { chunk, changes }
  if (Array.isArray(changesMap)) {
    changesMap.forEach((entry) => {
      const { chunk, changes } = entry;

      if (!changes) {
        return;
      }

      if (Array.isArray(changes)) {
        if (changes.length > 0 && changes[0]?.fieldName) {
          // Field changes (from ObjectChunk)
          fieldChanges.push(
            ...changes.map((change) => ({
              ...change,
              chunkInfo: chunk,
            })),
          );
        } else if (changes.length > 0 && "index" in changes[0]) {
          // Array item changes (from CompositeListChunk) - { index: number, data: ObjectDraft, missingFields?: ... }[]
          arrayChanges.push({
            chunk,
            items: changes,
          });
        } else if (changes.length > 0) {
          // Generic array changes
          arrayChanges.push({
            chunk,
            items: changes,
          });
        }
      } else if (changes === null) {
        // Null indicates array layout change without specific items
        arrayChanges.push({
          chunk,
          items: [],
        });
      }
    });
    return { fieldChanges, arrayChanges };
  }

  // Handle Map structure (old format, for backward compatibility)
  if (changesMap instanceof Map) {
    changesMap.forEach((value, key) => {
      if (Array.isArray(value)) {
        if (value.length > 0 && value[0]?.fieldInfo) {
          // Field changes
          fieldChanges.push(...value);
        } else {
          // Array changes
          arrayChanges.push({
            key,
            items: value,
          });
        }
      } else if (value === null) {
        // Null value indicates array change with no detailed item info
        arrayChanges.push({
          key,
          items: [],
        });
      }
    });
  } else {
    // Handle plain object (old serialized format from Map)
    for (const key in changesMap) {
      const value = changesMap[key];
      if (Array.isArray(value)) {
        if (value.length > 0 && value[0]?.fieldInfo) {
          // Field changes
          fieldChanges.push(...value);
        } else {
          // Array changes
          arrayChanges.push({
            key,
            items: value,
          });
        }
      } else if (value === null) {
        // Null value indicates array change with no detailed item info
        arrayChanges.push({
          key,
          items: [],
        });
      }
    }
  }

  return { fieldChanges, arrayChanges };
}

function getValuePreview(value: any): string {
  if (value === undefined) return "undefined";
  if (value === null) return "null";
  if (typeof value === "string") {
    return value.length > 30 ? `"${value.slice(0, 30)}..."` : `"${value}"`;
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  if (typeof value === "object") {
    // For GraphValue with data property (kind is a number, not string)
    if (
      "kind" in value &&
      typeof value.kind === "number" &&
      "data" in value &&
      typeof value.data !== "undefined"
    ) {
      return getValuePreview(value.data);
    }
    // For arrays
    if (Array.isArray(value)) {
      return `[${value.length} items]`;
    }
    // For objects
    const keys = Object.keys(value);
    if (keys.length === 0) return "{}";
    if (keys.length === 1) return `{ ${keys[0]}: ... }`;
    return `{ ${keys.length} fields }`;
  }
  return String(value);
}

function formatValue(value: any): string {
  if (value === undefined) return "undefined";
  if (value === null) return "null";
  if (typeof value === "object") {
    // For objects, check if it's a GraphValue with data property and kind (kind is a number)
    if (
      "kind" in value &&
      typeof value.kind === "number" &&
      "data" in value &&
      typeof value.data !== "undefined"
    ) {
      return JSON.stringify(value.data, null, 2);
    }
    // Otherwise serialize the object itself (e.g., ObjectDraft which is a plain object)
    return JSON.stringify(value, null, 2);
  }
  return String(value);
}
