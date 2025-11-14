import React from "react";
import { Text } from "@fluentui/react-components";
import type { IndexItem } from "./arrayDiffUtils";
import { formatValueForDisplay, formatDataPreview } from "./arrayDiffUtils";
import { useArrayDiffViewerStyles } from "../ArrayDiffViewer.styles";

interface ArrayIndexItemProps {
  item: IndexItem;
  isExpanded: boolean;
  isOld: boolean;
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
  hoveredIndex,
  onMouseEnter,
  onMouseLeave,
  onClick,
  setRef,
}) => {
  const classes = useArrayDiffViewerStyles();

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

  return (
    <div
      className={`${classes.indexBox} ${
        item.state === "unchanged" ? classes.unchangedBox : ""
      }`}
      ref={setRef}
      onMouseEnter={item.state !== "unchanged" ? onMouseEnter : undefined}
      onMouseLeave={item.state !== "unchanged" ? onMouseLeave : undefined}
      onClick={item.state !== "unchanged" ? onClick : undefined}
    >
      <div className={classes.indexLabel}>
        <Text>[{item.index}]</Text>
        {item.state !== "unchanged" && (
          <Text
            className={`${classes.stateLabel} ${getStateLabel(item.state)}`}
          >
            {item.state}
          </Text>
        )}
      </div>
      {item.state !== "unchanged" && (
        <div className={getContentClassName()}>
          {isExpanded
            ? formatValueForDisplay(item.data)
            : formatDataPreview(item.data)}
        </div>
      )}
      {item.state === "unchanged" && (
        <div
          className={`${classes.indexContent} ${classes.indexContentCollapsed} ${classes.unchangedContent}`}
        >
          <em style={{ color: "#666" }}>unchanged</em>
        </div>
      )}
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
