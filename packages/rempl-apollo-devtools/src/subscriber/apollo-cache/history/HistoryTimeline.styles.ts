import { makeStyles, shorthands } from "@fluentui/react-components";
import { SPACING_LG, SPACING_SM, SPACING_MD } from "./shared/styles/spacing";

export const useHistoryTimelineStyles = makeStyles({
  container: {
    display: "flex",
    flexDirection: "column",
    ...shorthands.overflow("hidden"),
    height: "100%",
    width: "100%",
    minHeight: 0,
    minWidth: 0,
    "@media (max-width: 839px)": {
      flexDirection: "row",
      height: "auto",
    },
  },
  header: {
    ...shorthands.padding(SPACING_MD, SPACING_LG),
    "@media (max-width: 839px)": {
      flexShrink: 0,
    },
  },
  list: {
    overflowY: "auto",
    overflowX: "hidden",
    ...shorthands.padding(SPACING_SM),
    ...shorthands.flex(1),
    minHeight: 0,
    "@media (max-width: 839px)": {
      overflowY: "hidden",
      overflowX: "auto",
      display: "flex",
      flexDirection: "row",
      ...shorthands.gap(SPACING_SM),
      alignItems: "stretch",
    },
  },
});
