import React, { useMemo } from "react";
import { FixedSizeList as List } from "react-window";
import { tokens } from "@fluentui/react-components";

interface JsonViewerProps {
  data: unknown;
  maxHeight?: number;
}

export const JsonViewer: React.FC<JsonViewerProps> = ({
  data,
  maxHeight = 400,
}) => {
  const lines = useMemo(() => {
    try {
      return JSON.stringify(data, null, 2).split("\n");
    } catch {
      return String(data).split("\n");
    }
  }, [data]);

  const Row = ({
    index,
    style,
  }: {
    index: number;
    style: React.CSSProperties;
  }) => (
    <div
      style={{
        ...style,
        whiteSpace: "pre",
        fontFamily: tokens.fontFamilyMonospace,
        fontSize: tokens.fontSizeBase200,
        lineHeight: "20px",
      }}
    >
      {lines[index]}
    </div>
  );

  const itemSize = 20;
  const height = Math.min(lines.length * itemSize, maxHeight);

  return (
    <div
      style={{
        backgroundColor: tokens.colorNeutralBackground2,
        borderRadius: tokens.borderRadiusMedium,
        padding: tokens.spacingHorizontalM,
      }}
    >
      <List
        height={height}
        itemCount={lines.length}
        itemSize={itemSize}
        width="100%"
      >
        {Row}
      </List>
    </div>
  );
};
