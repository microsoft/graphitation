import React, { useMemo } from "react";
import { FixedSizeList as List } from "react-window";
import { useVirtualizedJsonViewerStyles } from "./VirtualizedJsonViewer.styles";

interface VirtualizedJsonViewerProps {
  data: unknown;
  maxHeight?: number;
}

export const VirtualizedJsonViewer: React.FC<VirtualizedJsonViewerProps> = ({
  data,
  maxHeight = 400,
}) => {
  const classes = useVirtualizedJsonViewerStyles();

  const lines = useMemo(() => {
    return JSON.stringify(data, null, 2).split("\n");
  }, [data]);

  const lineHeight = 20;
  const listHeight = Math.min(lines.length * lineHeight, maxHeight);

  // For small datasets, just render normally
  if (lines.length < 20) {
    return (
      <pre
        className={classes.container}
        style={{ maxHeight, overflow: "auto" }}
      >
        {JSON.stringify(data, null, 2)}
      </pre>
    );
  }

  const Row = ({
    index,
    style,
  }: {
    index: number;
    style: React.CSSProperties;
  }) => (
    <div style={style} className={classes.line}>
      {lines[index]}
    </div>
  );

  return (
    <div className={classes.container}>
      <List
        height={listHeight}
        itemCount={lines.length}
        itemSize={lineHeight}
        width="100%"
      >
        {Row}
      </List>
    </div>
  );
};
