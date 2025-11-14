import { makeStyles, shorthands, tokens } from "@fluentui/react-components";

export const useTimelineItemStyles = makeStyles({
  item: {
    ...shorthands.padding(tokens.spacingVerticalS, tokens.spacingHorizontalM),
    ...shorthands.margin(tokens.spacingVerticalXS, 0),
    ...shorthands.borderRadius(tokens.borderRadiusMedium),
    cursor: "pointer",
    display: "flex",
    flexDirection: "column",
    ...shorthands.gap(tokens.spacingVerticalXXS),
    ...shorthands.borderLeft("3px", "solid", "transparent"),
    ...shorthands.transition("all", "0.15s", "ease-in-out"),
    "&:hover": {
      backgroundColor: tokens.colorNeutralBackground1Hover,
      ...shorthands.borderLeft("3px", "solid", tokens.colorBrandStroke1),
    },
    "&:focus-visible": {
      ...shorthands.borderLeft("3px", "solid", tokens.colorBrandStroke1),
      boxShadow: tokens.shadow4,
    },
  },
  itemActive: {
    backgroundColor: tokens.colorBrandBackground2,
    ...shorthands.borderLeft("3px", "solid", tokens.colorBrandStroke1),
    "&:hover": {
      backgroundColor: tokens.colorBrandBackground2Hover,
    },
  },
  itemOptimistic: {
    backgroundColor: "rgba(0, 120, 212, 0.08)",
    ...shorthands.borderLeft("3px", "solid", tokens.colorBrandStroke1),
    "&:hover": {
      backgroundColor: "rgba(0, 120, 212, 0.12)",
    },
  },
  itemOptimisticActive: {
    backgroundColor: "rgba(0, 120, 212, 0.18)",
    ...shorthands.borderLeft("3px", "solid", tokens.colorBrandStroke1),
    "&:hover": {
      backgroundColor: "rgba(0, 120, 212, 0.22)",
    },
  },
  itemWithMissingFields: {
    backgroundColor: "rgba(245, 159, 0, 0.05)",
    ...shorthands.borderLeft("3px", "solid", tokens.colorPaletteYellowBorder1),
    boxShadow: `inset 0 0 0 1px ${tokens.colorStatusWarningBorder1}`,
    "&:hover": {
      backgroundColor: "rgba(245, 159, 0, 0.08)",
    },
  },
  itemHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  },
  itemTitle: {
    fontWeight: tokens.fontWeightSemibold,
    fontSize: tokens.fontSizeBase300,
  },
  itemTime: {
    color: tokens.colorNeutralForeground3,
    fontFamily: tokens.fontFamilyMonospace,
    fontSize: tokens.fontSizeBase200,
  },
  operationName: {
    color: tokens.colorBrandForeground1,
    fontFamily: tokens.fontFamilyMonospace,
    fontSize: tokens.fontSizeBase200,
  },
  tagRow: {
    display: "flex",
    flexWrap: "wrap",
    ...shorthands.gap(tokens.spacingHorizontalXS),
  },
});
