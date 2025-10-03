import { makeStyles, shorthands, tokens } from "@fluentui/react-components";

export const useStyles = makeStyles({
  root: {
    position: "fixed",
    top: 0,
    left: 0,
    width: "100%",
    height: "100%",
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 1000,
  },
  dialogContainer: {
    backgroundColor: tokens.colorNeutralBackground1,
    ...shorthands.borderRadius(tokens.borderRadiusLarge),
    maxWidth: "90%",
    width: "1200px",
    maxHeight: "90vh",
    display: "grid",
    gridTemplateRows: "auto 1fr",
    boxShadow: tokens.shadow64,
    ...shorthands.overflow("hidden"),
  },
  header: {
    display: "grid",
    gridTemplateColumns: "1fr auto",
    alignItems: "start",
    ...shorthands.gap(tokens.spacingHorizontalM),
    ...shorthands.padding(tokens.spacingVerticalL, tokens.spacingHorizontalL),
    ...shorthands.borderBottom(
      tokens.strokeWidthThin,
      "solid",
      tokens.colorNeutralStroke1,
    ),
  },
  headerContent: {
    display: "flex",
    flexDirection: "column",
    ...shorthands.gap(tokens.spacingVerticalS),
  },
  operationMetadata: {
    display: "flex",
    flexDirection: "column",
    ...shorthands.gap(tokens.spacingVerticalXXS),
    ...shorthands.padding(tokens.spacingVerticalS, tokens.spacingHorizontalM),
    backgroundColor: tokens.colorNeutralBackground2,
    ...shorthands.borderRadius(tokens.borderRadiusMedium),
    ...shorthands.border(
      tokens.strokeWidthThin,
      "solid",
      tokens.colorNeutralStroke2,
    ),
  },
  operationVariables: {
    fontFamily: tokens.fontFamilyMonospace,
    fontSize: tokens.fontSizeBase200,
    color: tokens.colorNeutralForeground2,
    wordBreak: "break-all",
  },
  closeButton: {
    minWidth: "auto",
    alignSelf: "start",
  },
  noHistory: {
    ...shorthands.padding(tokens.spacingVerticalXXL),
    textAlign: "center",
    color: tokens.colorNeutralForeground3,
  },
  contentContainer: {
    display: "grid",
    gridTemplateColumns: "280px 1fr",
    ...shorthands.overflow("hidden"),
    height: "100%",
  },
  timeline: {
    ...shorthands.borderRight(
      tokens.strokeWidthThin,
      "solid",
      tokens.colorNeutralStroke1,
    ),
    display: "grid",
    gridTemplateRows: "auto 1fr",
    ...shorthands.overflow("hidden"),
  },
  sectionTitle: {
    ...shorthands.padding(tokens.spacingVerticalM, tokens.spacingHorizontalM),
    ...shorthands.borderBottom(
      tokens.strokeWidthThin,
      "solid",
      tokens.colorNeutralStroke1,
    ),
  },
  timelineList: {
    overflowY: "auto",
    ...shorthands.padding(tokens.spacingVerticalS),
  },
  timelineItem: {
    ...shorthands.padding(tokens.spacingVerticalS, tokens.spacingHorizontalM),
    ...shorthands.margin(tokens.spacingVerticalXS, 0),
    ...shorthands.borderRadius(tokens.borderRadiusMedium),
    cursor: "pointer",
    ...shorthands.transition("background-color", "0.2s"),
    "&:hover": {
      backgroundColor: tokens.colorNeutralBackground1Hover,
    },
  },
  timelineItemActive: {
    backgroundColor: tokens.colorBrandBackground2,
    "&:hover": {
      backgroundColor: tokens.colorBrandBackground2Hover,
    },
  },
  timelineItemIncomplete: {
    backgroundColor: "rgba(255, 200, 100, 0.15)",
    ...shorthands.borderLeft(
      "3px",
      "solid",
      tokens.colorPaletteYellowBackground3,
    ),
    "&:hover": {
      backgroundColor: "rgba(255, 200, 100, 0.25)",
    },
  },
  timelineItemHeader: {
    display: "flex",
    alignItems: "center",
    ...shorthands.gap(tokens.spacingHorizontalXS),
  },
  timelineItemTime: {
    color: tokens.colorNeutralForeground3,
    marginLeft: "24px",
  },
  operationName: {
    color: tokens.colorBrandForeground1,
    marginLeft: "24px",
    fontFamily: tokens.fontFamilyMonospace,
  },
  incompleteWarning: {
    color: tokens.colorPaletteYellowForeground1,
    marginLeft: "24px",
    fontWeight: tokens.fontWeightSemibold,
  },
  detailsPanel: {
    overflowY: "auto",
    ...shorthands.padding(tokens.spacingVerticalL, tokens.spacingHorizontalL),
  },
  emptyState: {
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    height: "100%",
    color: tokens.colorNeutralForeground3,
  },
  detailsContent: {
    display: "flex",
    flexDirection: "column",
    ...shorthands.gap(tokens.spacingVerticalL),
  },
  detailSection: {
    ...shorthands.padding(tokens.spacingVerticalM, 0),
    ...shorthands.borderBottom(
      tokens.strokeWidthThin,
      "solid",
      tokens.colorNeutralStroke1,
    ),
  },
  timestamp: {
    display: "block",
    marginBottom: tokens.spacingVerticalS,
  },
  operationInfo: {
    color: tokens.colorNeutralForeground3,
    fontFamily: tokens.fontFamilyMonospace,
  },
  variablesSection: {
    marginTop: tokens.spacingVerticalS,
    ...shorthands.padding(tokens.spacingVerticalS),
    backgroundColor: tokens.colorNeutralBackground2,
    ...shorthands.borderRadius(tokens.borderRadiusSmall),
  },
  section: {
    display: "flex",
    flexDirection: "column",
  },
  sectionHeader: {
    justifyContent: "flex-start",
    ...shorthands.padding(tokens.spacingVerticalS, 0),
    width: "100%",
    ...shorthands.gap(tokens.spacingHorizontalS),
  },
  chevron: {
    ...shorthands.transition("transform", "0.2s"),
  },
  chevronExpanded: {
    transform: "rotate(90deg)",
  },
  sectionContent: {
    ...shorthands.padding(tokens.spacingVerticalM, tokens.spacingHorizontalL),
  },
  changesGroup: {
    marginBottom: tokens.spacingVerticalL,
  },
  changesLabel: {
    display: "block",
    marginBottom: tokens.spacingVerticalM,
    color: tokens.colorBrandForeground1,
  },
  changeItem: {
    ...shorthands.margin(tokens.spacingVerticalS, 0),
    ...shorthands.padding(tokens.spacingVerticalS),
    ...shorthands.border(
      tokens.strokeWidthThin,
      "solid",
      tokens.colorNeutralStroke1,
    ),
    ...shorthands.borderRadius(tokens.borderRadiusMedium),
    backgroundColor: tokens.colorNeutralBackground2,
  },
  changeItemHeader: {
    width: "100%",
    justifyContent: "flex-start",
    ...shorthands.padding(0),
    ...shorthands.gap(tokens.spacingHorizontalXS),
    minHeight: "auto",
  },
  changeChevron: {
    ...shorthands.transition("transform", "0.2s"),
    fontSize: "16px",
  },
  fieldName: {
    fontFamily: tokens.fontFamilyMonospace,
    fontWeight: tokens.fontWeightSemibold,
    color: tokens.colorNeutralForeground1,
  },
  changeType: {
    color: tokens.colorNeutralForeground3,
    fontStyle: "italic",
  },
  changePreview: {
    color: tokens.colorNeutralForeground2,
    fontSize: tokens.fontSizeBase200,
    marginLeft: tokens.spacingHorizontalS,
  },
  changeDetails: {
    marginTop: tokens.spacingVerticalM,
    marginLeft: tokens.spacingHorizontalL,
    ...shorthands.padding(tokens.spacingVerticalM),
    backgroundColor: tokens.colorNeutralBackground1,
    ...shorthands.borderRadius(tokens.borderRadiusMedium),
  },
  metadataSection: {
    ...shorthands.padding(tokens.spacingVerticalS),
    ...shorthands.margin(tokens.spacingVerticalS, 0),
    ...shorthands.borderRadius(tokens.borderRadiusSmall),
    backgroundColor: "rgba(255, 200, 100, 0.1)",
    ...shorthands.border(
      tokens.strokeWidthThin,
      "solid",
      "rgba(255, 200, 100, 0.3)",
    ),
  },
  warningText: {
    color: tokens.colorPaletteYellowForeground1,
    display: "block",
    marginBottom: tokens.spacingVerticalXS,
  },
  valueComparison: {
    display: "flex",
    ...shorthands.gap(tokens.spacingHorizontalL),
  },
  oldValue: {
    ...shorthands.flex(1),
    ...shorthands.padding(tokens.spacingVerticalS),
    backgroundColor: "rgba(255, 100, 100, 0.1)",
    ...shorthands.borderRadius(tokens.borderRadiusSmall),
  },
  newValue: {
    ...shorthands.flex(1),
    ...shorthands.padding(tokens.spacingVerticalS),
    backgroundColor: "rgba(100, 255, 100, 0.1)",
    ...shorthands.borderRadius(tokens.borderRadiusSmall),
  },
  fillerValue: {
    ...shorthands.padding(tokens.spacingVerticalS),
    backgroundColor: "rgba(100, 150, 255, 0.1)",
    ...shorthands.borderRadius(tokens.borderRadiusSmall),
  },
  inlineCode: {
    fontFamily: tokens.fontFamilyMonospace,
    fontSize: tokens.fontSizeBase200,
    ...shorthands.padding(tokens.spacingVerticalXS),
    whiteSpace: "pre-wrap",
    wordBreak: "break-word",
    marginTop: tokens.spacingVerticalXS,
  },
  arrayItemChange: {
    ...shorthands.padding(tokens.spacingVerticalS),
    ...shorthands.margin(tokens.spacingVerticalXS, 0),
    ...shorthands.borderRadius(tokens.borderRadiusSmall),
    backgroundColor: tokens.colorNeutralBackground3,
  },
  codeBlock: {
    fontFamily: tokens.fontFamilyMonospace,
    fontSize: tokens.fontSizeBase200,
    ...shorthands.padding(tokens.spacingVerticalM),
    backgroundColor: tokens.colorNeutralBackground3,
    ...shorthands.borderRadius(tokens.borderRadiusMedium),
    ...shorthands.overflow("auto"),
    maxHeight: "400px",
  },
  noChanges: {
    color: tokens.colorNeutralForeground3,
    fontStyle: "italic",
  },
  missingSectionTitle: {
    color: tokens.colorPaletteYellowForeground1,
  },
  missingFieldsItem: {
    ...shorthands.padding(tokens.spacingVerticalM),
    ...shorthands.margin(tokens.spacingVerticalS, 0),
    ...shorthands.borderRadius(tokens.borderRadiusMedium),
    backgroundColor: "rgba(255, 200, 100, 0.1)",
    ...shorthands.border(
      tokens.strokeWidthThin,
      "solid",
      "rgba(255, 200, 100, 0.3)",
    ),
  },
  missingFieldsList: {
    display: "flex",
    flexWrap: "wrap",
    ...shorthands.gap(tokens.spacingHorizontalXS),
    marginTop: tokens.spacingVerticalS,
  },
  missingFieldChip: {
    ...shorthands.padding(tokens.spacingVerticalXXS, tokens.spacingHorizontalS),
    backgroundColor: tokens.colorPaletteYellowBackground1,
    ...shorthands.borderRadius(tokens.borderRadiusSmall),
    ...shorthands.border(
      tokens.strokeWidthThin,
      "solid",
      tokens.colorPaletteYellowBorder1,
    ),
  },
  // Diff viewer styles
  diffViewerContainer: {
    marginTop: tokens.spacingVerticalM,
    ...shorthands.border(
      tokens.strokeWidthThin,
      "solid",
      tokens.colorNeutralStroke2,
    ),
    ...shorthands.borderRadius(tokens.borderRadiusMedium),
    ...shorthands.overflow("hidden"),
  },
  diffViewerHeader: {
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
  },
  diffViewerContent: {
    maxHeight: "500px",
    overflowY: "auto",
    backgroundColor: tokens.colorNeutralBackground1,
    fontFamily: tokens.fontFamilyMonospace,
    fontSize: tokens.fontSizeBase200,
  },
  diffLine: {
    display: "flex",
    ...shorthands.padding(tokens.spacingVerticalXXS, tokens.spacingHorizontalS),
    whiteSpace: "pre",
    fontFamily: "inherit",
    fontSize: "inherit",
  },
  diffLineNumber: {
    minWidth: "40px",
    textAlign: "right",
    marginRight: tokens.spacingHorizontalM,
    color: tokens.colorNeutralForeground3,
    userSelect: "none",
  },
  diffLineContent: {
    flex: "1",
    whiteSpace: "pre-wrap",
    wordBreak: "break-all",
  },
  diffLineAdded: {
    backgroundColor: "rgba(46, 160, 67, 0.15)",
    ...shorthands.borderLeft(
      "3px",
      "solid",
      tokens.colorPaletteGreenForeground1,
    ),
  },
  diffLineDeleted: {
    backgroundColor: "rgba(229, 83, 75, 0.15)",
    ...shorthands.borderLeft("3px", "solid", tokens.colorPaletteRedForeground1),
  },
  diffLineModified: {
    backgroundColor: "rgba(245, 159, 0, 0.15)",
    ...shorthands.borderLeft(
      "3px",
      "solid",
      tokens.colorPaletteYellowForeground1,
    ),
  },
  diffLineUnchanged: {
    backgroundColor: tokens.colorNeutralBackground1,
    color: tokens.colorNeutralForeground3,
  },
  diffStats: {
    display: "flex",
    ...shorthands.gap(tokens.spacingHorizontalM),
    fontSize: tokens.fontSizeBase200,
  },
  diffStatItem: {
    display: "flex",
    alignItems: "center",
    ...shorthands.gap(tokens.spacingHorizontalXXS),
  },
  diffStatAdded: {
    color: tokens.colorPaletteGreenForeground1,
  },
  diffStatDeleted: {
    color: tokens.colorPaletteRedForeground1,
  },
  diffStatModified: {
    color: tokens.colorPaletteYellowForeground1,
  },
  diffButton: {
    marginTop: tokens.spacingVerticalS,
  },
});
