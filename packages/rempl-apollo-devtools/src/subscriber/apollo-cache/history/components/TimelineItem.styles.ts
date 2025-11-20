import { makeStyles, shorthands, tokens } from "@fluentui/react-components";
import { SPACING_SM, SPACING_MD, SPACING_XS } from "../shared/styles/spacing";

export const useTimelineItemStyles = makeStyles({
  item: {
    ...shorthands.padding(SPACING_SM, SPACING_MD),
    ...shorthands.margin(SPACING_XS, 0),
    ...shorthands.borderRadius(tokens.borderRadiusMedium),
    cursor: "pointer",
    display: "flex",
    flexDirection: "column",
    ...shorthands.gap(SPACING_XS),
    ...shorthands.borderLeft("3px", "solid", "transparent"),
    ...shorthands.transition("all", "0.15s", "ease-in-out"),
    minWidth: 0,
    "&:hover": {
      backgroundColor: tokens.colorNeutralBackground1Hover,
      ...shorthands.borderLeft("3px", "solid", tokens.colorBrandStroke1),
    },
    "&:focus-visible": {
      ...shorthands.borderLeft("3px", "solid", tokens.colorBrandStroke1),
      boxShadow: tokens.shadow4,
    },
    "@media (max-width: 839px)": {
      ...shorthands.margin(0),
      ...shorthands.borderLeft("none"),
      ...shorthands.borderTop("3px", "solid", "transparent"),
      minWidth: "200px",
      flexShrink: 0,
      "&:hover": {
        backgroundColor: tokens.colorNeutralBackground1Hover,
        ...shorthands.borderLeft("none"),
        ...shorthands.borderTop("3px", "solid", tokens.colorBrandStroke1),
      },
      "&:focus-visible": {
        ...shorthands.borderLeft("none"),
        ...shorthands.borderTop("3px", "solid", tokens.colorBrandStroke1),
        boxShadow: tokens.shadow4,
      },
    },
  },
  itemActive: {
    backgroundColor: tokens.colorBrandBackground2,
    ...shorthands.borderLeft("3px", "solid", tokens.colorBrandStroke1),
    "&:hover": {
      backgroundColor: tokens.colorBrandBackground2Hover,
    },
    "@media (max-width: 839px)": {
      ...shorthands.borderLeft("none"),
      ...shorthands.borderTop("3px", "solid", tokens.colorBrandStroke1),
    },
  },
  itemOptimistic: {
    backgroundColor: "rgba(0, 120, 212, 0.08)",
    ...shorthands.borderLeft("3px", "solid", tokens.colorBrandStroke1),
    "&:hover": {
      backgroundColor: "rgba(0, 120, 212, 0.12)",
    },
    "@media (max-width: 839px)": {
      ...shorthands.borderLeft("none"),
      ...shorthands.borderTop("3px", "solid", tokens.colorBrandStroke1),
    },
  },
  itemOptimisticActive: {
    backgroundColor: "rgba(0, 120, 212, 0.18)",
    ...shorthands.borderLeft("3px", "solid", tokens.colorBrandStroke1),
    "&:hover": {
      backgroundColor: "rgba(0, 120, 212, 0.22)",
    },
    "@media (max-width: 839px)": {
      ...shorthands.borderLeft("none"),
      ...shorthands.borderTop("3px", "solid", tokens.colorBrandStroke1),
    },
  },
  itemWithMissingFields: {
    backgroundColor: "rgba(245, 159, 0, 0.05)",
    ...shorthands.borderLeft("3px", "solid", tokens.colorPaletteYellowBorder1),
    boxShadow: `inset 0 0 0 1px ${tokens.colorStatusWarningBorder1}`,
    "&:hover": {
      backgroundColor: "rgba(245, 159, 0, 0.08)",
    },
    "@media (max-width: 839px)": {
      ...shorthands.borderLeft("none"),
      ...shorthands.borderTop("3px", "solid", tokens.colorPaletteYellowBorder1),
    },
  },
  itemHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    ...shorthands.gap(SPACING_SM),
    minWidth: 0,
  },
  itemTitle: {
    fontWeight: tokens.fontWeightSemibold,
    fontSize: tokens.fontSizeBase200,
    flexShrink: 0,
  },
  itemTime: {
    color: tokens.colorNeutralForeground3,
    fontFamily: tokens.fontFamilyMonospace,
    fontSize: tokens.fontSizeBase200,
    flexShrink: 0,
  },
  operationName: {
    color: tokens.colorBrandForeground1,
    fontFamily: tokens.fontFamilyMonospace,
    fontSize: tokens.fontSizeBase200,
    ...shorthands.overflow("hidden"),
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  tagRow: {
    display: "flex",
    flexWrap: "wrap",
    ...shorthands.gap(SPACING_XS),
  },
});
