import { makeStyles, shorthands, tokens } from "@fluentui/react-components";
import {
  SPACING_SM,
  SPACING_MD,
  SPACING_XS,
} from "./shared/styles/spacing";

export const useNodeDiffsListStyles = makeStyles({
  container: {
    display: "flex",
    flexDirection: "column",
    ...shorthands.gap(tokens.spacingVerticalM),
  },
  emptyState: {
    ...shorthands.padding(tokens.spacingVerticalL),
    textAlign: "center",
    color: tokens.colorNeutralForeground3,
    fontStyle: "italic",
  },
  nodeDiffItem: {
    ...shorthands.padding(tokens.spacingVerticalM, tokens.spacingHorizontalM),
    ...shorthands.borderRadius(tokens.borderRadiusMedium),
    ...shorthands.border(
      tokens.strokeWidthThin,
      "solid",
      tokens.colorNeutralStroke2,
    ),
    backgroundColor: tokens.colorNeutralBackground1,
  },
  nodeHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: tokens.spacingVerticalM,
    paddingBottom: tokens.spacingVerticalS,
    ...shorthands.borderBottom(
      tokens.strokeWidthThin,
      "solid",
      tokens.colorNeutralStroke2,
    ),
  },
  nodeKey: {
    fontFamily: tokens.fontFamilyMonospace,
    fontWeight: tokens.fontWeightSemibold,
    color: tokens.colorBrandForeground1,
    fontSize: tokens.fontSizeBase300,
  },
  completeBadge: {
    fontSize: tokens.fontSizeBase200,
    ...shorthands.padding(tokens.spacingVerticalXXS, tokens.spacingHorizontalS),
    ...shorthands.borderRadius(tokens.borderRadiusSmall),
    fontWeight: tokens.fontWeightSemibold,
  },
  completeTrue: {
    backgroundColor: "rgba(16, 124, 16, 0.15)",
    color: tokens.colorPaletteGreenForeground1,
  },
  completeFalse: {
    backgroundColor: "rgba(229, 83, 75, 0.15)",
    color: tokens.colorPaletteRedForeground1,
  },
  fieldsLabel: {
    display: "block",
    fontWeight: tokens.fontWeightSemibold,
    marginBottom: tokens.spacingVerticalS,
    fontSize: tokens.fontSizeBase200,
    color: tokens.colorNeutralForeground2,
    textTransform: "uppercase",
    letterSpacing: "0.5px",
  },
  fieldsList: {
    display: "flex",
    flexDirection: "column",
    ...shorthands.gap(tokens.spacingVerticalS),
  },
  fieldTag: {
    display: "flex",
    flexDirection: "column",
    ...shorthands.padding(tokens.spacingVerticalS, tokens.spacingHorizontalM),
    backgroundColor: tokens.colorNeutralBackground2,
    ...shorthands.borderRadius(tokens.borderRadiusMedium),
    fontFamily: tokens.fontFamilyMonospace,
    fontSize: tokens.fontSizeBase200,
    ...shorthands.border(
      tokens.strokeWidthThin,
      "solid",
      tokens.colorNeutralStroke2,
    ),
  },
});
