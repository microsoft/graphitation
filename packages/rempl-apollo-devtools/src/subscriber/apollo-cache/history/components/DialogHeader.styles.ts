import { makeStyles, shorthands, tokens } from "@fluentui/react-components";
import { SPACING_SM, SPACING_MD, SPACING_XL } from "../shared/styles/spacing";

export const useDialogHeaderStyles = makeStyles({
  header: {
    display: "flex",
    flexDirection: "column",
    ...shorthands.gap(SPACING_SM),
    ...shorthands.padding(SPACING_MD, SPACING_XL),
    ...shorthands.borderBottom(
      tokens.strokeWidthThin,
      "solid",
      tokens.colorNeutralStroke2,
    ),
    position: "relative",
    minHeight: 0,
  },
  operationRow: {
    display: "flex",
    alignItems: "baseline",
    ...shorthands.gap(SPACING_MD),
    flexWrap: "wrap",
    minWidth: 0,
  },
  operationKey: {
    fontFamily: tokens.fontFamilyMonospace,
    fontSize: tokens.fontSizeBase200,
    color: tokens.colorNeutralForeground3,
    wordBreak: "break-word",
  },
  operationName: {
    fontSize: tokens.fontSizeBase300,
    fontWeight: tokens.fontWeightSemibold,
    color: tokens.colorNeutralForeground2,
    wordBreak: "break-word",
    flexShrink: 0,
  },
  variables: {
    fontFamily: tokens.fontFamilyMonospace,
    fontSize: tokens.fontSizeBase200,
    color: tokens.colorNeutralForeground3,
    wordBreak: "break-word",
    minWidth: 0,
    flexGrow: 1,
  },
  closeButton: {
    position: "absolute",
    top: SPACING_MD,
    right: SPACING_MD,
    minWidth: "auto",
  },
});
