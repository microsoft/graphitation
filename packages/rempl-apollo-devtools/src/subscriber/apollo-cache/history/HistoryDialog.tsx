import React, { useContext, useMemo } from "react";
import type { CacheObjectWithSize } from "../types";
import { ApolloCacheContext } from "../../contexts/apollo-cache-context";
import { useHistoryData, useHistorySelection } from "./hooks";
import { DialogHeader } from "./components/DialogHeader";
import { HistoryTimeline } from "./HistoryTimeline";
import { HistoryDetails } from "./HistoryDetails";
import { Loading } from "./shared";
import { useHistoryDialogStyles } from "./HistoryDialog.styles";

interface HistoryDialogProps {
  item: CacheObjectWithSize | undefined;
  onClose: () => void;
}

export const HistoryDialog: React.FC<HistoryDialogProps> = ({
  item,
  onClose,
}) => {
  const classes = useHistoryDialogStyles();
  const cacheContext = useContext(ApolloCacheContext);

  // Fetch history data
  const { history, operationData, totalCount, loading } = useHistoryData({
    operationKey: item?.key,
    getOperationHistory: cacheContext?.getOperationHistory,
  });

  // Manage selection
  const { selectedIndex, selectedEntry, selectEntry } = useHistorySelection({
    history,
  });

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

  return (
    <div className={classes.overlay} onClick={onClose}>
      <div className={classes.dialog} onClick={(e) => e.stopPropagation()}>
        <DialogHeader
          operationInfo={operationInfo}
          operationKey={item?.key}
          historyCount={history.length}
          totalCount={totalCount}
          onClose={onClose}
        />

        {loading || !selectedEntry ? (
          <Loading
            label={`Loading history${item?.key ? ` for ${item.key}` : "..."}`}
          />
        ) : (
          <div className={classes.contentContainer}>
            <HistoryTimeline
              history={history}
              selectedIndex={selectedIndex}
              totalCount={totalCount}
              onSelectEntry={selectEntry}
            />
            <div className={classes.detailsPanel}>
              <HistoryDetails entry={selectedEntry} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
