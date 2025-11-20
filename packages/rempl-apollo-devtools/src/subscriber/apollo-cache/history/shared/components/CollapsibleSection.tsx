import React from "react";
import {
  makeStyles,
  shorthands,
  tokens,
  Text,
  mergeClasses,
} from "@fluentui/react-components";
import { ChevronRight20Regular } from "@fluentui/react-icons";

const useStyles = makeStyles({
  container: {
    display: "flex",
    flexDirection: "column",
    ...shorthands.gap(tokens.spacingVerticalS),
  },
  header: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    ...shorthands.gap(tokens.spacingHorizontalS),
    cursor: "pointer",
    ...shorthands.padding(tokens.spacingVerticalS, 0),
    userSelect: "none",
    backgroundColor: "transparent",
    width: "100%",
    textAlign: "left",
    color: "inherit",
    ...shorthands.borderRadius(tokens.borderRadiusMedium),
    ...shorthands.border(0, "solid", "transparent"),
    selectors: {
      "&:hover svg": {
        color: tokens.colorBrandForeground1,
      },
    },
    "&:focus-visible": {
      boxShadow: tokens.shadow4,
      outlineStyle: "solid",
      outlineWidth: tokens.strokeWidthThin,
      outlineColor: tokens.colorBrandStroke1,
    },
    "&:disabled": {
      cursor: "default",
      opacity: 0.6,
    },
  },
  headerContent: {
    display: "flex",
    alignItems: "center",
    ...shorthands.gap(tokens.spacingHorizontalS),
    flexGrow: 1,
    minWidth: 0,
  },
  chevron: {
    fontSize: "16px",
    color: tokens.colorNeutralForeground3,
    ...shorthands.transition("transform", "0.2s", "ease-in-out"),
    flexShrink: 0,
  },
  chevronExpanded: {
    transform: "rotate(90deg)",
  },
  title: {
    fontWeight: tokens.fontWeightSemibold,
    color: tokens.colorNeutralForeground1,
    fontSize: tokens.fontSizeBase300,
  },
  badge: {
    marginLeft: tokens.spacingHorizontalXS,
    fontSize: tokens.fontSizeBase200,
    color: tokens.colorNeutralForeground3,
  },
  content: {
    ...shorthands.padding(tokens.spacingVerticalS, 0),
  },
});

export interface CollapsibleSectionProps {
  title: string;
  isExpanded: boolean;
  onToggle: () => void;
  children: React.ReactNode;
  renderHeaderOnly?: boolean;
  badge?: React.ReactNode;
  disabled?: boolean;
}

export const CollapsibleSection: React.FC<CollapsibleSectionProps> = ({
  title,
  isExpanded,
  onToggle,
  children,
  renderHeaderOnly = false,
  badge,
  disabled = false,
}) => {
  const classes = useStyles();

  const header = (
    <button
      type="button"
      className={classes.header}
      onClick={onToggle}
      disabled={disabled}
      aria-expanded={isExpanded}
    >
      <span className={classes.headerContent}>
        <Text className={classes.title}>{title}</Text>
        {badge && <span className={classes.badge}>{badge}</span>}
      </span>
      <ChevronRight20Regular
        className={mergeClasses(
          classes.chevron,
          isExpanded && classes.chevronExpanded,
        )}
      />
    </button>
  );

  if (renderHeaderOnly) {
    return header;
  }

  return (
    <div className={classes.container}>
      {header}
      {isExpanded && <div className={classes.content}>{children}</div>}
    </div>
  );
};
