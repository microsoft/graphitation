import React from "react";
import {
  makeStyles,
  shorthands,
  tokens,
  Spinner,
  Text,
} from "@fluentui/react-components";

const useStyles = makeStyles({
  container: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    ...shorthands.gap(tokens.spacingVerticalM),
    ...shorthands.padding(tokens.spacingVerticalXXL),
    minHeight: "200px",
  },
  label: {
    color: tokens.colorNeutralForeground2,
    fontSize: tokens.fontSizeBase300,
  },
});

export interface LoadingProps {
  label?: string;
  size?:
    | "tiny"
    | "extra-small"
    | "small"
    | "medium"
    | "large"
    | "extra-large"
    | "huge";
  className?: string;
}

export const Loading: React.FC<LoadingProps> = ({
  label,
  size = "medium",
  className,
}) => {
  const classes = useStyles();

  return (
    <div className={`${classes.container} ${className || ""}`}>
      <Spinner size={size} />
      {label && <Text className={classes.label}>{label}</Text>}
    </div>
  );
};
