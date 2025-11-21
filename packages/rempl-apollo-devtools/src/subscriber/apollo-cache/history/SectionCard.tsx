import React, { useState } from "react";
import { Text, mergeClasses } from "@fluentui/react-components";
import { ChevronRight20Regular } from "@fluentui/react-icons";
import { useSectionCardStyles } from "./SectionCard.styles";

export interface SectionCardProps {
  title: React.ReactNode;
  badge?: string;
  /** If true, section starts expanded (only for collapsible sections) */
  defaultExpanded?: boolean;
  children: React.ReactNode;
  /** If true, the section can be collapsed/expanded */
  collapsible?: boolean;
  /** Variant for nested subsections */
  variant?: "default" | "nested";
  /** Optional action element to display in the header (e.g., a switch) */
  headerAction?: React.ReactNode;
  /** If true and variant is nested, removes top border and padding */
  isFirstChild?: boolean;
}

export const SectionCard: React.FC<SectionCardProps> = ({
  title,
  badge,
  defaultExpanded = false,
  children,
  collapsible = true,
  variant = "default",
  headerAction,
  isFirstChild = false,
}) => {
  const classes = useSectionCardStyles();
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  const titleClass = variant === "nested" ? classes.nestedTitle : classes.title;
  const headerClass =
    variant === "nested" ? classes.nestedHeader : classes.header;
  const staticHeaderClass =
    variant === "nested" ? classes.nestedHeader : classes.staticHeader;

  const handleToggle = () => {
    if (collapsible) {
      setIsExpanded((prev) => !prev);
    }
  };

  const header = collapsible ? (
    <button
      type="button"
      className={headerClass}
      onClick={handleToggle}
      aria-expanded={isExpanded}
    >
      <span className={classes.headerContent}>
        <Text className={titleClass}>{title}</Text>
        {badge && <span className={classes.badge}>{badge}</span>}
      </span>
      <ChevronRight20Regular
        className={mergeClasses(
          classes.chevron,
          isExpanded && classes.chevronExpanded,
        )}
      />
    </button>
  ) : (
    <div className={staticHeaderClass}>
      <span className={classes.headerContent}>
        <Text className={titleClass}>{title}</Text>
        {badge && <span className={classes.badge}>{badge}</span>}
      </span>
      {headerAction && (
        <div className={classes.headerAction}>{headerAction}</div>
      )}
    </div>
  );

  const cardClass =
    variant === "nested"
      ? mergeClasses(
          classes.nestedCard,
          isFirstChild && classes.nestedCardFirst,
        )
      : classes.card;

  return (
    <div className={cardClass}>
      {header}
      {(!collapsible || isExpanded) && (
        <div className={classes.content}>{children}</div>
      )}
    </div>
  );
};
