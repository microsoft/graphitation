import { makeStyles, shorthands, tokens } from "@fluentui/react-components";

export const useDiffViewerStyles = makeStyles({
  diffContainer: {
    ...shorthands.border(
      tokens.strokeWidthThin,
      "solid",
      tokens.colorNeutralStroke2,
    ),
    ...shorthands.borderRadius(tokens.borderRadiusMedium),
    ...shorthands.overflow("hidden"),
    backgroundColor: tokens.colorNeutralBackground1,
    fontFamily: tokens.fontFamilyMonospace,
    fontSize: tokens.fontSizeBase200,
  },
  diffContent: {
    maxHeight: "600px",
    overflowY: "auto",
  },
  diffLine: {
    display: "flex",
    minHeight: "20px",
    lineHeight: "20px",
    ...shorthands.padding(0, tokens.spacingHorizontalS),
    fontFamily: tokens.fontFamilyMonospace,
    fontSize: tokens.fontSizeBase200,
  },
  lineNumber: {
    color: tokens.colorNeutralForeground3,
    textAlign: "right",
    userSelect: "none",
    paddingRight: tokens.spacingHorizontalXS,
    minWidth: "40px",
    flexShrink: 0,
  },
  lineContent: {
    whiteSpace: "pre-wrap",
    wordBreak: "break-all",
    overflowWrap: "break-word",
    flexGrow: 1,
    minWidth: 0,
  },
  lineContext: {
    backgroundColor: tokens.colorNeutralBackground1,
  },
  lineAdded: {
    backgroundColor: "rgba(46, 160, 67, 0.15)",
    color: tokens.colorNeutralForeground1,
  },
  lineAddedMarker: {
    color: tokens.colorPaletteGreenForeground1,
  },
  lineRemoved: {
    backgroundColor: "rgba(248, 81, 73, 0.15)",
    color: tokens.colorNeutralForeground1,
  },
  lineRemovedMarker: {
    color: tokens.colorPaletteRedForeground1,
  },
  hunkHeader: {
    backgroundColor: tokens.colorNeutralBackground2,
    color: tokens.colorBrandForeground1,
    ...shorthands.padding(tokens.spacingVerticalXS, tokens.spacingHorizontalS),
    fontWeight: tokens.fontWeightSemibold,
    ...shorthands.borderTop(
      tokens.strokeWidthThin,
      "solid",
      tokens.colorNeutralStroke2,
    ),
    ...shorthands.borderBottom(
      tokens.strokeWidthThin,
      "solid",
      tokens.colorNeutralStroke2,
    ),
  },
  navigationBar: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    ...shorthands.padding(tokens.spacingVerticalS, tokens.spacingHorizontalM),
    backgroundColor: tokens.colorNeutralBackground2,
    ...shorthands.borderBottom(
      tokens.strokeWidthThin,
      "solid",
      tokens.colorNeutralStroke2,
    ),
    position: "sticky",
    top: 0,
    zIndex: 10,
  },
  navigationButtons: {
    display: "flex",
    ...shorthands.gap(tokens.spacingHorizontalXS),
    alignItems: "center",
  },
  changeMap: {
    display: "flex",
    alignItems: "center",
    ...shorthands.gap(tokens.spacingHorizontalS),
    ...shorthands.flex(1),
    maxWidth: "400px",
    marginLeft: tokens.spacingHorizontalM,
  },
  changeMapBar: {
    ...shorthands.flex(1),
    height: "20px",
    backgroundColor: tokens.colorNeutralBackground3,
    ...shorthands.borderRadius(tokens.borderRadiusSmall),
    position: "relative",
    ...shorthands.border(
      tokens.strokeWidthThin,
      "solid",
      tokens.colorNeutralStroke2,
    ),
    ...shorthands.overflow("hidden"),
    cursor: "pointer",
    "&:hover": {
      backgroundColor: tokens.colorNeutralBackground3Hover,
    },
  },
  changeMarker: {
    position: "absolute",
    width: "3px",
    height: "100%",
    top: 0,
  },
  addedMarker: {
    backgroundColor: tokens.colorPaletteGreenForeground1,
  },
  removedMarker: {
    backgroundColor: tokens.colorPaletteRedForeground1,
  },
});
