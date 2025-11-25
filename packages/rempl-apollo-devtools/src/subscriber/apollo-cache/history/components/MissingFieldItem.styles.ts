import { makeStyles, shorthands, tokens } from "@fluentui/react-components";

export const useMissingFieldItemStyles = makeStyles({
  container: {
    display: "flex",
    flexDirection: "column",
    ...shorthands.gap(tokens.spacingVerticalXS),
    ...shorthands.padding(tokens.spacingVerticalS, tokens.spacingHorizontalM),
    backgroundColor: tokens.colorStatusWarningBackground1,
    ...shorthands.borderRadius(tokens.borderRadiusMedium),
    ...shorthands.border(
      tokens.strokeWidthThin,
      "solid",
      tokens.colorStatusWarningBorder1,
    ),
  },
  identifier: {
    fontWeight: tokens.fontWeightSemibold,
    fontSize: tokens.fontSizeBase300,
    color: tokens.colorNeutralForeground1,
    fontFamily: tokens.fontFamilyMonospace,
  },
  fieldsContainer: {
    display: "flex",
    ...shorthands.gap(tokens.spacingHorizontalXS),
    flexWrap: "wrap",
  },
});
