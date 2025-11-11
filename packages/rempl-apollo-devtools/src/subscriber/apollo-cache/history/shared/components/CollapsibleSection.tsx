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
    ...shorthands.gap(tokens.spacingHorizontalS),
    cursor: "pointer",
    ...shorthands.padding(tokens.spacingVerticalXS, 0),
    userSelect: "none",
    "&:hover": {
      "& $chevron": {
        color: tokens.colorBrandForeground1,
      },
    },
  },
  headerDisabled: {
    cursor: "default",
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
    <div
      className={mergeClasses(
        classes.header,
        disabled && classes.headerDisabled,
      )}
      onClick={disabled ? undefined : onToggle}
      role="button"
      tabIndex={disabled ? -1 : 0}
      onKeyDown={(e) => {
        if (!disabled && (e.key === "Enter" || e.key === " ")) {
          e.preventDefault();
          onToggle();
        }
      }}
      aria-expanded={isExpanded}
    >
      <ChevronRight20Regular
        className={mergeClasses(
          classes.chevron,
          isExpanded && classes.chevronExpanded,
        )}
      />
      <Text className={classes.title}>{title}</Text>
      {badge && <span className={classes.badge}>{badge}</span>}
    </div>
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
