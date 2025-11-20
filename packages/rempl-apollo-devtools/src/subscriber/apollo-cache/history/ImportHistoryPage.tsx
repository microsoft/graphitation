import React, { useState } from "react";
import {
  makeStyles,
  shorthands,
  tokens,
  Text,
  Button,
  Textarea,
} from "@fluentui/react-components";
import { ArrowUpload20Regular, Dismiss20Regular } from "@fluentui/react-icons";
import type { HistoryEntry } from "../../../history/types";
import { HistoryTimeline } from "./HistoryTimeline";
import { HistoryDetails } from "./HistoryDetails";

const useStyles = makeStyles({
  root: {
    flexShrink: 1,
    flexGrow: 1,
    flexBasic: 0,
    height: "100%",
    ...shorthands.padding("10px"),
  },
  innerContainer: {
    display: "flex",
    flexDirection: "column",
    height: "100%",
    backgroundColor: "#fff",
    ...shorthands.borderRadius("6px"),
  },
  importSection: {
    display: "flex",
    flexDirection: "column",
    ...shorthands.gap(tokens.spacingVerticalL),
    ...shorthands.padding(tokens.spacingVerticalXL, tokens.spacingHorizontalXL),
    maxWidth: "900px",
  },
  header: {
    display: "flex",
    flexDirection: "column",
    ...shorthands.gap(tokens.spacingVerticalS),
  },
  title: {
    fontSize: tokens.fontSizeBase500,
    fontWeight: tokens.fontWeightSemibold,
    color: tokens.colorNeutralForeground1,
  },
  description: {
    fontSize: tokens.fontSizeBase300,
    color: tokens.colorNeutralForeground3,
    lineHeight: tokens.lineHeightBase300,
  },
  code: {
    fontFamily: tokens.fontFamilyMonospace,
    backgroundColor: tokens.colorNeutralBackground3,
    ...shorthands.padding("2px", tokens.spacingHorizontalXXS),
    ...shorthands.borderRadius(tokens.borderRadiusSmall),
  },
  textareaContainer: {
    display: "flex",
    flexDirection: "column",
    ...shorthands.gap(tokens.spacingVerticalS),
  },
  textarea: {
    minHeight: "200px",
    fontFamily: tokens.fontFamilyMonospace,
    fontSize: tokens.fontSizeBase200,
  },
  actions: {
    display: "flex",
    ...shorthands.gap(tokens.spacingHorizontalM),
  },
  errorMessage: {
    ...shorthands.padding(tokens.spacingVerticalM, tokens.spacingHorizontalM),
    backgroundColor: tokens.colorPaletteRedBackground1,
    ...shorthands.borderRadius(tokens.borderRadiusMedium),
    ...shorthands.border(
      tokens.strokeWidthThin,
      "solid",
      tokens.colorPaletteRedBorder1,
    ),
    color: tokens.colorPaletteRedForeground1,
    fontSize: tokens.fontSizeBase300,
  },
  historyView: {
    display: "grid",
    gridTemplateColumns: "300px 1fr",
    ...shorthands.overflow("hidden"),
    ...shorthands.flex(1),
  },
  detailsPanel: {
    ...shorthands.overflow("hidden"),
    height: "100%",
  },
});

export const ImportHistoryPage: React.FC = () => {
  const classes = useStyles();
  const [jsonInput, setJsonInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [totalEntries, setTotalEntries] = useState<number>(0);
  const [selectedEntryIndex, setSelectedEntryIndex] = useState<number | null>(
    null,
  );

  const handleImport = () => {
    setError(null);

    if (!jsonInput.trim()) {
      setError("Please paste JSON history data");
      return;
    }

    try {
      const parsed = JSON.parse(jsonInput);

      // Validate it has the required structure
      if (typeof parsed !== "object" || parsed === null) {
        setError(
          'History data must be an object with "totalEntries" and "history" fields',
        );
        return;
      }

      if (!("history" in parsed) || !Array.isArray(parsed.history)) {
        setError('History data must have a "history" array field');
        return;
      }

      if (
        !("totalEntries" in parsed) ||
        typeof parsed.totalEntries !== "number"
      ) {
        setError('History data must have a "totalEntries" number field');
        return;
      }

      // Basic validation of entries
      if (parsed.history.length === 0) {
        setError("History array is empty");
        return;
      }

      // Validate each entry has required fields
      for (let i = 0; i < parsed.history.length; i++) {
        const entry = parsed.history[i];
        if (!entry.timestamp || !entry.kind || !entry.modifyingOperation) {
          setError(
            `Invalid history entry at index ${i}: missing required fields (timestamp, kind, modifyingOperation)`,
          );
          return;
        }
      }

      // Import successful
      setHistory(parsed.history as HistoryEntry[]);
      setTotalEntries(parsed.totalEntries);
      // Auto-select the most recent entry
      if (parsed.history.length > 0) {
        setSelectedEntryIndex(parsed.history.length - 1);
      }
    } catch (e) {
      if (e instanceof Error) {
        setError(`Failed to parse JSON: ${e.message}`);
      } else {
        setError("Failed to parse JSON");
      }
    }
  };

  const handleClear = () => {
    setHistory([]);
    setTotalEntries(0);
    setSelectedEntryIndex(null);
    setJsonInput("");
    setError(null);
  };

  if (history.length > 0) {
    const selectedEntry = selectedEntryIndex ?? history.length - 1;
    return (
      <div className={classes.root}>
        <div className={classes.innerContainer}>
          <div className={classes.historyView}>
            <HistoryTimeline
              history={history}
              totalCount={totalEntries}
              selectedIndex={selectedEntryIndex}
              onSelectEntry={setSelectedEntryIndex}
            />
            <div className={classes.detailsPanel}>
              <HistoryDetails entry={history[selectedEntry]} />
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={classes.root}>
      <div className={classes.innerContainer}>
        <div className={classes.importSection}>
          <div className={classes.header}>
            <Text className={classes.title}>Import History from JSON</Text>
            <Text className={classes.description}>
              <strong>How to get history from your app:</strong> Call{" "}
              <span className={classes.code}>TODO</span>
            </Text>
          </div>

          <div className={classes.textareaContainer}>
            <Text weight="semibold">History JSON:</Text>
            <Textarea
              className={classes.textarea}
              value={jsonInput}
              onChange={(_, data) => setJsonInput(data.value)}
              placeholder="Paste history JSON array here..."
              resize="vertical"
            />
          </div>

          {error && <div className={classes.errorMessage}>{error}</div>}

          <div className={classes.actions}>
            <Button
              appearance="primary"
              icon={<ArrowUpload20Regular />}
              onClick={handleImport}
            >
              Import History
            </Button>
            <Button
              appearance="secondary"
              onClick={handleClear}
              icon={<Dismiss20Regular />}
            >
              Clear
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
