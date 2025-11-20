import React from "react";
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

  return (
    <pre className={classes.container} style={{ maxHeight, overflowY: "auto" }}>
      {JSON.stringify(data, null, 2)}
    </pre>
  );
};
