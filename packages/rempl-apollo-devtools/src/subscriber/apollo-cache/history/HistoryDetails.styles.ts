import { makeStyles, shorthands, tokens } from "@fluentui/react-components";

export const useHistoryDetailsStyles = makeStyles({
  root: {
    display: "flex",
    flexDirection: "column",
    height: "100%",
    ...shorthands.overflow("hidden"),
  },
  scrollContainer: {
    ...shorthands.flex(1),
    overflowY: "auto",
    ...shorthands.padding(tokens.spacingHorizontalM),
  },
  content: {
    display: "flex",
    flexDirection: "column",
    ...shorthands.gap(tokens.spacingVerticalL),
    ...shorthands.padding(
      tokens.spacingVerticalM,
      0,
      tokens.spacingVerticalXXL,
      0,
    ),
  },
  header: {
    display: "flex",
    flexDirection: "column",
    ...shorthands.gap(tokens.spacingVerticalS),
    ...shorthands.padding(0, 0, tokens.spacingVerticalL, 0),
    ...shorthands.borderBottom(
      tokens.strokeWidthThin,
      "solid",
      tokens.colorNeutralStroke1,
    ),
  },
  badges: {
    display: "flex",
    ...shorthands.gap(tokens.spacingHorizontalS),
    flexWrap: "wrap",
  },
  section: {
    display: "flex",
    flexDirection: "column",
    ...shorthands.gap(tokens.spacingVerticalS),
  },
  sectionHeaderWithSwitch: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    ...shorthands.padding(0, tokens.spacingHorizontalM, 0, 0),
  },
  sectionHeaderLeft: {
    display: "flex",
    alignItems: "center",
    ...shorthands.gap(tokens.spacingHorizontalS),
    cursor: "pointer",
    ...shorthands.flex(1),
  },
  missingFieldsSection: {
    display: "flex",
    flexDirection: "column",
    ...shorthands.gap(tokens.spacingVerticalM),
  },
});
