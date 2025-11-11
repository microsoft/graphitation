import { makeStyles, shorthands, tokens } from "@fluentui/react-components";

export const useOperationMetadataStyles = makeStyles({
  container: {
    display: "flex",
    flexDirection: "column",
    ...shorthands.gap(tokens.spacingVerticalS),
  },
  metaItem: {
    display: "flex",
    alignItems: "flex-start",
    ...shorthands.gap(tokens.spacingHorizontalM),
  },
  label: {
    fontWeight: tokens.fontWeightSemibold,
    color: tokens.colorNeutralForeground2,
    minWidth: "80px",
    flexShrink: 0,
    fontSize: tokens.fontSizeBase300,
  },
  value: {
    fontFamily: tokens.fontFamilyMonospace,
    fontSize: tokens.fontSizeBase300,
    color: tokens.colorNeutralForeground1,
    flexGrow: 1,
    minWidth: 0,
  },
});
