import { makeStyles, shorthands, tokens } from "@fluentui/react-components";
import { SPACING_SM, SPACING_LG } from "../shared/styles/spacing";

export const useOperationMetadataStyles = makeStyles({
  container: {
    display: "flex",
    flexDirection: "column",
    ...shorthands.gap(SPACING_SM),
  },
  metaItem: {
    display: "flex",
    alignItems: "flex-start",
    ...shorthands.gap(SPACING_LG),
    minWidth: 0,
  },
  label: {
    fontWeight: tokens.fontWeightSemibold,
    color: tokens.colorNeutralForeground3,
    minWidth: "80px",
    flexShrink: 0,
    fontSize: tokens.fontSizeBase200,
  },
  value: {
    fontFamily: tokens.fontFamilyMonospace,
    fontSize: tokens.fontSizeBase200,
    color: tokens.colorNeutralForeground2,
    flexGrow: 1,
    minWidth: 0,
    wordBreak: "break-word",
    ...shorthands.overflow("hidden"),
  },
  inlineVariables: {
    fontFamily: tokens.fontFamilyMonospace,
    fontSize: tokens.fontSizeBase200,
    color: tokens.colorNeutralForeground3,
    wordBreak: "break-word",
    flexGrow: 1,
    minWidth: 0,
  },
});
