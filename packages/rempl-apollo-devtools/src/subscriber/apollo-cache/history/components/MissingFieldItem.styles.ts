import { makeStyles, shorthands, tokens } from "@fluentui/react-components";

export const useMissingFieldItemStyles = makeStyles({
  container: {
    display: "flex",
    flexDirection: "column",
    ...shorthands.gap(tokens.spacingVerticalXS),
    ...shorthands.padding(tokens.spacingVerticalS, 0),
    ...shorthands.borderBottom(
      tokens.strokeWidthThin,
      "solid",
      tokens.colorNeutralStroke2,
    ),
    "&:last-child": {
      borderBottomWidth: 0,
    },
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
    ...shorthands.padding(0, 0, 0, tokens.spacingHorizontalM),
  },
});
