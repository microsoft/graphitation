import React, { useState, useEffect, useContext, useMemo } from "react";
import {
  makeStyles,
  shorthands,
  tokens,
  Text,
  Button,
  Title1,
} from "@fluentui/react-components";
import { Dismiss20Regular } from "@fluentui/react-icons";
import type { CacheObjectWithSize } from "../types";
import type { HistoryEntry } from "../../../history/types";
import { ApolloCacheContext } from "../../contexts/apollo-cache-context";
import { HistoryTimeline } from "./HistoryTimeline";
import { HistoryDetails } from "./HistoryDetails";
import {
  EmptyHistoryState,
  LoadingHistoryState,
  EmptySelectionState,
} from "./EmptyStates";

const useStyles = makeStyles({
  overlay: {
    position: "fixed",
    top: 0,
    left: 0,
    width: "100%",
    height: "100%",
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 1000,
  },
  dialog: {
    backgroundColor: tokens.colorNeutralBackground1,
    ...shorthands.borderRadius(tokens.borderRadiusLarge),
    maxWidth: "95vw",
    width: "1400px",
    maxHeight: "90vh",
    display: "grid",
    gridTemplateRows: "auto 1fr",
    boxShadow: tokens.shadow64,
    ...shorthands.overflow("hidden"),
  },
  header: {
    display: "grid",
    gridTemplateColumns: "1fr auto",
    alignItems: "center",
    ...shorthands.gap(tokens.spacingHorizontalM),
    ...shorthands.padding(tokens.spacingVerticalL, tokens.spacingHorizontalL),
    ...shorthands.borderBottom(
      tokens.strokeWidthThin,
      "solid",
      tokens.colorNeutralStroke1,
    ),
    backgroundColor: tokens.colorNeutralBackground2,
  },
  headerContent: {
    display: "flex",
    flexDirection: "column",
    ...shorthands.gap(tokens.spacingVerticalXS),
    minWidth: 0,
    flexGrow: 1,
  },
  operationKey: {
    fontFamily: tokens.fontFamilyMonospace,
    fontSize: tokens.fontSizeBase300,
    color: tokens.colorNeutralForeground2,
  },
  operationName: {
    fontSize: tokens.fontSizeBase400,
    fontWeight: tokens.fontWeightSemibold,
    color: tokens.colorNeutralForeground1,
  },
  variablesPreview: {
    fontFamily: tokens.fontFamilyMonospace,
    fontSize: tokens.fontSizeBase200,
    color: tokens.colorNeutralForeground3,
    ...shorthands.padding(tokens.spacingVerticalXS, tokens.spacingHorizontalS),
    backgroundColor: tokens.colorNeutralBackground3,
    ...shorthands.borderRadius(tokens.borderRadiusSmall),
    maxHeight: "80px",
    overflowY: "auto",
    whiteSpace: "pre-wrap",
    wordBreak: "break-word",
  },
  closeButton: {
    minWidth: "auto",
  },
  contentContainer: {
    display: "grid",
    gridTemplateColumns: "300px 1fr",
    ...shorthands.overflow("hidden"),
    height: "100%",
  },
  detailsPanel: {
    ...shorthands.overflow("hidden"),
    height: "100%",
  },
});

interface HistoryDialogProps {
  item: CacheObjectWithSize | undefined;
  onClose: () => void;
}

export const HistoryDialog: React.FC<HistoryDialogProps> = ({
  item,
  onClose,
}) => {
  const classes = useStyles();
  const [selectedEntryIndex, setSelectedEntryIndex] = useState<number | null>(
    null,
  );
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [operationData, setOperationData] = useState<{
    name: string;
    variables?: Record<string, unknown>;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const cacheContext = useContext(ApolloCacheContext);

  const getOperationHistory = useMemo(
    () => cacheContext?.getOperationHistory,
    [cacheContext?.getOperationHistory],
  );

  // Fetch history on-demand
  useEffect(() => {
    const fetchHistory = async () => {
      if (!item?.key || !getOperationHistory) {
        setHistory([]);
        setOperationData(null);
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        const response: any = await getOperationHistory(item.key);
        if (response) {
          // Handle new response format with operation data
          if (
            !Array.isArray(response) &&
            response.history &&
            Array.isArray(response.history)
          ) {
            setHistory(response.history as HistoryEntry[]);
            setOperationData(response.operation || null);
            // Auto-select the most recent entry
            if (response.history.length > 0) {
              setSelectedEntryIndex(response.history.length - 1);
            }
          }
          // Handle legacy format (just array of history)
          else if (Array.isArray(response)) {
            setHistory(response as HistoryEntry[]);
            setOperationData(null);
            if (response.length > 0) {
              setSelectedEntryIndex(response.length - 1);
            }
          } else {
            setHistory([]);
            setOperationData(null);
          }
        } else {
          setHistory([]);
          setOperationData(null);
        }
      } catch (e) {
        console.error("Failed to fetch history:", e);
        setHistory([]);
        setOperationData(null);
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

  // Get operation info from the tree operation data (from publisher)
  // This is the actual query that was opened, not the modifying operations in history
  const operationInfo = useMemo(() => {
    if (operationData) {
      return operationData;
    }

    // Fallback: extract operation name from item.key (format: "operationName:id")
    if (item?.key) {
      const colonIndex = item.key.lastIndexOf(":");
      if (colonIndex > 0) {
        return {
          name: item.key.substring(0, colonIndex),
          variables: undefined,
        };
      }
    }

    return { name: "Anonymous Operation", variables: undefined };
  }, [operationData, item?.key]);

  const hasVariables =
    operationInfo?.variables && Object.keys(operationInfo.variables).length > 0;

  return (
    <div className={classes.overlay} onClick={onClose}>
      <div className={classes.dialog} onClick={(e) => e.stopPropagation()}>
        <div className={classes.header}>
          <div className={classes.headerContent}>
            <Title1>Operation History</Title1>
            {operationInfo && (
              <>
                <Text className={classes.operationName}>
                  {operationInfo.name}
                </Text>
                {hasVariables && (
                  <pre className={classes.variablesPreview}>
                    {JSON.stringify(operationInfo.variables, null, 2)}
                  </pre>
                )}
              </>
            )}
            {item?.key && !operationInfo && (
              <Text className={classes.operationKey}>{item.key}</Text>
            )}
          </div>
          <Button
            appearance="transparent"
            onClick={onClose}
            className={classes.closeButton}
            icon={<Dismiss20Regular />}
            aria-label="Close"
          />
        </div>

        {loading ? (
          <LoadingHistoryState operationKey={item?.key} />
        ) : history.length === 0 ? (
          <EmptyHistoryState operationKey={item?.key} />
        ) : (
          <div className={classes.contentContainer}>
            <HistoryTimeline
              history={history}
              selectedIndex={selectedEntryIndex}
              onSelectEntry={setSelectedEntryIndex}
            />
            <div className={classes.detailsPanel}>
              {selectedEntry ? (
                <HistoryDetails entry={selectedEntry} />
              ) : (
                <EmptySelectionState />
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
