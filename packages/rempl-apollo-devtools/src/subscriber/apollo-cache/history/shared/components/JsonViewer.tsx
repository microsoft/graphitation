import React, { useMemo } from "react";
import { VirtualizerScrollView } from "@fluentui/react-virtualizer";
import { tokens } from "@fluentui/react-components";
import { formatValue } from "../diffUtils";

interface JsonViewerProps {
  data: unknown;
  maxHeight?: number;
}

export const JsonViewer: React.FC<JsonViewerProps> = ({
  data,
  maxHeight = 400,
}) => {
  const lines = useMemo(() => formatValue(data).split("\n"), [data]);

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
      <VirtualizerScrollView
        numItems={lines.length}
        itemSize={itemSize}
        container={{ style: { height, maxHeight, overflowY: "auto" } }}
      >
        {(index) => (
          <div
            key={index}
            style={{
              whiteSpace: "pre",
              fontFamily: tokens.fontFamilyMonospace,
              fontSize: tokens.fontSizeBase200,
              lineHeight: "20px",
              height: "20px",
            }}
          >
            {lines[index]}
          </div>
        )}
      </VirtualizerScrollView>
    </div>
  );
};
