import { makeStyles, shorthands, tokens } from "@fluentui/react-components";

export const useFieldChangesListStyles = makeStyles({
  container: {
    display: "flex",
    flexDirection: "column",
    ...shorthands.gap(tokens.spacingVerticalS),
  },
  emptyState: {
    ...shorthands.padding(tokens.spacingVerticalL),
    textAlign: "center",
    color: tokens.colorNeutralForeground3,
    fontStyle: "italic",
  },
  changeItem: {
    ...shorthands.borderRadius(tokens.borderRadiusMedium),
    ...shorthands.border(
      tokens.strokeWidthThin,
      "solid",
      tokens.colorNeutralStroke2,
    ),
    ...shorthands.overflow("hidden"),
  },
  changeHeader: {
    display: "flex",
    alignItems: "center",
    ...shorthands.gap(tokens.spacingHorizontalS),
    ...shorthands.padding(tokens.spacingVerticalS, tokens.spacingHorizontalM),
    cursor: "pointer",
    backgroundColor: tokens.colorNeutralBackground2,
    ...shorthands.transition("background-color", "0.15s"),
    "&:hover": {
      backgroundColor: tokens.colorNeutralBackground2Hover,
    },
  },
  chevron: {
    fontSize: "16px",
    color: tokens.colorNeutralForeground3,
    ...shorthands.transition("transform", "0.2s"),
    flexShrink: 0,
  },
  chevronExpanded: {
    transform: "rotate(90deg)",
  },
  fieldPath: {
    fontFamily: tokens.fontFamilyMonospace,
    fontWeight: tokens.fontWeightSemibold,
    color: tokens.colorNeutralForeground1,
    ...shorthands.flex(1),
    fontSize: tokens.fontSizeBase300,
  },
  changeKindBadge: {
    fontSize: tokens.fontSizeBase100,
    ...shorthands.padding(
      tokens.spacingVerticalXXS,
      tokens.spacingHorizontalXS,
    ),
    ...shorthands.borderRadius(tokens.borderRadiusSmall),
    fontWeight: tokens.fontWeightSemibold,
  },
  badgeFiller: {
    backgroundColor: "rgba(16, 124, 16, 0.15)",
    color: tokens.colorPaletteGreenForeground1,
  },
  badgeReplacement: {
    backgroundColor: "rgba(0, 120, 212, 0.15)",
    color: tokens.colorBrandForeground1,
  },
  badgeList: {
    backgroundColor: "rgba(245, 159, 0, 0.15)",
    color: tokens.colorPaletteYellowForeground1,
  },
  previewText: {
    color: tokens.colorNeutralForeground2,
    fontSize: tokens.fontSizeBase200,
    maxWidth: "300px",
    ...shorthands.overflow("hidden"),
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  changeContent: {
    ...shorthands.padding(tokens.spacingVerticalM, tokens.spacingHorizontalM),
    backgroundColor: tokens.colorNeutralBackground1,
  },
  valueComparison: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    ...shorthands.gap(tokens.spacingHorizontalM),
    width: "100%",
    minWidth: 0,
  },
  valueBox: {
    display: "flex",
    flexDirection: "column",
    ...shorthands.gap(tokens.spacingVerticalXS),
    minWidth: 0,
    maxWidth: "100%",
    ...shorthands.overflow("hidden"),
  },
  valueLabel: {
    fontSize: tokens.fontSizeBase200,
    fontWeight: tokens.fontWeightSemibold,
    color: tokens.colorNeutralForeground2,
  },
  codeBlock: {
    fontFamily: tokens.fontFamilyMonospace,
    fontSize: tokens.fontSizeBase200,
    ...shorthands.padding(tokens.spacingVerticalS, tokens.spacingHorizontalS),
    backgroundColor: tokens.colorNeutralBackground3,
    ...shorthands.borderRadius(tokens.borderRadiusMedium),
    maxHeight: "300px",
    overflowY: "auto",
    overflowX: "hidden",
    ...shorthands.border(
      tokens.strokeWidthThin,
      "solid",
      tokens.colorNeutralStroke2,
    ),
    whiteSpace: "pre-wrap",
    wordBreak: "break-word",
    overflowWrap: "anywhere",
    minWidth: 0,
    maxWidth: "100%",
    boxSizing: "border-box",
  },
});
