import React from "react";
import { Text, Tooltip } from "@fluentui/react-components";
import type { IndexItem } from "./arrayDiffUtils";
import { formatDataPreview } from "./arrayDiffUtils";
import { useArrayDiffViewerStyles } from "../ArrayDiffViewer.styles";
import { formatValue } from "../shared/diffUtils";

interface ArrayIndexItemProps {
  item: IndexItem;
  isExpanded: boolean;
  isOld: boolean;
  isOptimistic?: boolean;
  hoveredIndex: number | null;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
  onClick: () => void;
  setRef: (el: HTMLDivElement | null) => void;
}

export const ArrayIndexItem: React.FC<ArrayIndexItemProps> = ({
  item,
  isExpanded,
  isOld,
  isOptimistic,
  hoveredIndex,
  onMouseEnter,
  onMouseLeave,
  onClick,
  setRef,
}) => {
  const classes = useArrayDiffViewerStyles();
  const isUnchanged = item.state === "unchanged";
  const isDataUnavailable = isOptimistic && item.data === undefined;

  if (isUnchanged) {
    return (
      <div
        className={`${classes.indexBox} ${classes.unchangedBox}`}
        ref={setRef}
      >
        <div className={classes.indexLabel}>
          <Text>[{item.index}]</Text>
        </div>
        <div
          className={`${classes.indexContent} ${classes.indexContentCollapsed} ${classes.unchangedContent}`}
        >
          <em style={{ color: "#666" }}>unchanged</em>
        </div>
      </div>
    );
  }

  const getStateLabel = (state: string) => {
    switch (state) {
      case "added":
        return classes.labelAdded;
      case "removed":
        return classes.labelRemoved;
      case "moved":
        return classes.labelMoved;
      default:
        return "";
    }
  };

  const getContentClassName = () => {
    const baseClasses = [
      classes.indexContent,
      isExpanded ? classes.indexContentExpanded : classes.indexContentCollapsed,
    ];

    if (item.state === "added") {
      baseClasses.push(classes.added);
    } else if (item.state === "removed") {
      baseClasses.push(classes.removed);
    } else if (item.state === "moved") {
      baseClasses.push(
        hoveredIndex === item.index ? classes.movedHovered : classes.moved,
      );
    }

    return baseClasses.join(" ");
  };

  const showHoverInfo =
    item.state === "moved" &&
    hoveredIndex === item.index &&
    (isOld ? item.newIndex !== undefined : item.oldIndex !== undefined);

  const renderContent = () => {
    if (isDataUnavailable) {
      return (
        <Tooltip
          content="Data not available for optimistic updates."
          relationship="description"
        >
          <span>not available</span>
        </Tooltip>
      );
    }
    return isExpanded ? formatValue(item.data) : formatDataPreview(item.data);
  };

  return (
    <div
      className={classes.indexBox}
      ref={setRef}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      onClick={isOptimistic ? undefined : onClick}
    >
      <div className={classes.indexLabel}>
        <Text>[{item.index}]</Text>
        <Text className={`${classes.stateLabel} ${getStateLabel(item.state)}`}>
          {item.state}
        </Text>
      </div>
      <div className={getContentClassName()}>{renderContent()}</div>
      {showHoverInfo && (
        <Text className={classes.hoverInfo}>
          {isOld
            ? `→ moves to [${item.newIndex}]`
            : `← from [${item.oldIndex}]`}
        </Text>
      )}
    </div>
  );
};
