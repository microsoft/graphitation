import React from "react";
import { makeStyles, shorthands, tokens } from "@fluentui/react-components";
import { formatValue } from "../diffUtils";

const useStyles = makeStyles({
  codeBlock: {
    fontFamily: tokens.fontFamilyMonospace,
    fontSize: tokens.fontSizeBase200,
    ...shorthands.padding(tokens.spacingVerticalS, tokens.spacingHorizontalS),
    ...shorthands.borderRadius(tokens.borderRadiusMedium),
    ...shorthands.border(
      tokens.strokeWidthThin,
      "solid",
      tokens.colorNeutralStroke2,
    ),
    overflowX: "auto",
    overflowY: "auto",
    whiteSpace: "pre-wrap",
    wordBreak: "break-word",
    maxHeight: "400px",
    minWidth: 0,
  },
  inline: {
    display: "inline",
    ...shorthands.padding(
      tokens.spacingVerticalXXS,
      tokens.spacingHorizontalXS,
    ),
    maxHeight: "none",
  },
});

export interface CodeBlockProps {
  value: unknown;
  language?: "json" | "javascript" | "typescript" | "text";
  inline?: boolean;
  maxHeight?: string;
  className?: string;
}

export const CodeBlock: React.FC<CodeBlockProps> = ({
  value,
  inline = false,
  maxHeight,
  className,
}) => {
  const classes = useStyles();

  const style = maxHeight ? { maxHeight } : undefined;

  return (
    <pre
      className={`${classes.codeBlock} ${inline ? classes.inline : ""} ${
        className || ""
      }`}
      style={style}
    >
      <code>{formatValue(value)}</code>
    </pre>
  );
};
