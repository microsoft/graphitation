import { makeStyles, shorthands, tokens } from "@fluentui/react-components";

export const useHistoryTimelineStyles = makeStyles({
  container: {
    ...shorthands.borderRight(
      tokens.strokeWidthThin,
      "solid",
      tokens.colorNeutralStroke1,
    ),
    display: "flex",
    flexDirection: "column",
    ...shorthands.overflow("hidden"),
    height: "100%",
  },
  header: {
    ...shorthands.padding(tokens.spacingVerticalM, tokens.spacingHorizontalM),
    ...shorthands.borderBottom(
      tokens.strokeWidthThin,
      "solid",
      tokens.colorNeutralStroke1,
    ),
    backgroundColor: tokens.colorNeutralBackground2,
  },
  list: {
    overflowY: "auto",
    ...shorthands.padding(tokens.spacingVerticalS),
    ...shorthands.flex(1),
  },
});
