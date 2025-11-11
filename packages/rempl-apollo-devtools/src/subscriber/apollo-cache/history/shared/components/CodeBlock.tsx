import React from "react";
import { makeStyles, shorthands, tokens } from "@fluentui/react-components";

const useStyles = makeStyles({
  codeBlock: {
    fontFamily: tokens.fontFamilyMonospace,
    fontSize: tokens.fontSizeBase200,
    ...shorthands.padding(tokens.spacingVerticalS, tokens.spacingHorizontalS),
    backgroundColor: tokens.colorNeutralBackground3,
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
  language = "json",
  inline = false,
  maxHeight,
  className,
}) => {
  const classes = useStyles();

  const formatValue = (): string => {
    if (typeof value === "string") {
      return value;
    }

    if (language === "json") {
      try {
        return JSON.stringify(value, null, 2);
      } catch (e) {
        return String(value);
      }
    }

    return String(value);
  };

  const style = maxHeight ? { maxHeight } : undefined;

  return (
    <pre
      className={`${classes.codeBlock} ${inline ? classes.inline : ""} ${
        className || ""
      }`}
      style={style}
    >
      <code>{formatValue()}</code>
    </pre>
  );
};
