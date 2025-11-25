import React, { useContext } from "react";
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

  return (
    <div className={classes.overlay} onClick={onClose}>
      <div className={classes.dialog} onClick={(e) => e.stopPropagation()}>
        <DialogHeader
          operationInfo={operationData}
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
