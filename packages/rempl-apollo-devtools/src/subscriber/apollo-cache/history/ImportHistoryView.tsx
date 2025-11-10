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

const useStyles = makeStyles({
  container: {
    display: "flex",
    flexDirection: "column",
    ...shorthands.gap(tokens.spacingVerticalL),
    ...shorthands.padding(tokens.spacingVerticalXL, tokens.spacingHorizontalXL),
    height: "100%",
    ...shorthands.overflow("auto"),
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
  textareaContainer: {
    display: "flex",
    flexDirection: "column",
    ...shorthands.gap(tokens.spacingVerticalS),
    ...shorthands.flex(1),
  },
  textarea: {
    minHeight: "400px",
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
  successMessage: {
    ...shorthands.padding(tokens.spacingVerticalM, tokens.spacingHorizontalM),
    backgroundColor: tokens.colorPaletteGreenBackground1,
    ...shorthands.borderRadius(tokens.borderRadiusMedium),
    ...shorthands.border(
      tokens.strokeWidthThin,
      "solid",
      tokens.colorPaletteGreenBorder1,
    ),
    color: tokens.colorPaletteGreenForeground1,
    fontSize: tokens.fontSizeBase300,
  },
  exampleBox: {
    ...shorthands.padding(tokens.spacingVerticalS, tokens.spacingHorizontalS),
    backgroundColor: tokens.colorNeutralBackground3,
    ...shorthands.borderRadius(tokens.borderRadiusSmall),
    fontFamily: tokens.fontFamilyMonospace,
    fontSize: tokens.fontSizeBase200,
    color: tokens.colorNeutralForeground2,
    whiteSpace: "pre",
    ...shorthands.overflow("auto"),
  },
  code: {
    fontFamily: tokens.fontFamilyMonospace,
    backgroundColor: tokens.colorNeutralBackground3,
    ...shorthands.padding("2px", tokens.spacingHorizontalXXS),
    ...shorthands.borderRadius(tokens.borderRadiusSmall),
  },
});

interface ImportHistoryViewProps {
  onImport: (history: HistoryEntry[]) => void;
  onCancel: () => void;
}

export const ImportHistoryView: React.FC<ImportHistoryViewProps> = ({
  onImport,
  onCancel,
}) => {
  const classes = useStyles();
  const [jsonInput, setJsonInput] = useState("");
  const [error, setError] = useState<string | null>(null);

  const handleImport = () => {
    setError(null);

    if (!jsonInput.trim()) {
      setError("Please paste JSON history data");
      return;
    }

    try {
      const parsed = JSON.parse(jsonInput);

      // Validate it's an array
      if (!Array.isArray(parsed)) {
        setError("History data must be an array of entries");
        return;
      }

      // Basic validation of entries
      if (parsed.length === 0) {
        setError("History array is empty");
        return;
      }

      // Validate each entry has required fields
      for (let i = 0; i < parsed.length; i++) {
        const entry = parsed[i];
        if (!entry.timestamp || !entry.kind || !entry.modifyingOperation) {
          setError(
            `Invalid history entry at index ${i}: missing required fields (timestamp, kind, modifyingOperation)`,
          );
          return;
        }
      }

      // Import successful
      onImport(parsed as HistoryEntry[]);
    } catch (e) {
      if (e instanceof Error) {
        setError(`Failed to parse JSON: ${e.message}`);
      } else {
        setError("Failed to parse JSON");
      }
    }
  };

  const exampleJson = `[
  {
    "kind": "Regular",
    "timestamp": 1699999999999,
    "modifyingOperation": {
      "name": "query MyQuery",
      "variables": {"id": "123"}
    },
    "changes": [...]
  }
]`;

  return (
    <div className={classes.container}>
      <div className={classes.header}>
        <Text className={classes.title}>Import History from JSON</Text>
        <Text className={classes.description}>
          <strong>How to get history from your app:</strong> Call{" "}
          <span className={classes.code}>
            cache.getOperationHistory("YourQueryName")
          </span>{" "}
          in your browser console, then copy the result and paste it here.
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

      <div>
        <Text
          weight="semibold"
          style={{ marginBottom: tokens.spacingVerticalS }}
        >
          Expected format:
        </Text>
        <div className={classes.exampleBox}>{exampleJson}</div>
      </div>

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
          onClick={onCancel}
          icon={<Dismiss20Regular />}
        >
          Cancel
        </Button>
      </div>
    </div>
  );
};
