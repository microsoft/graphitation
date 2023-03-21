import { makeStyles, shorthands } from "@fluentui/react-components";

export const useStyles = makeStyles({
  root: {
    flexShrink: 1,
    flexGrow: 1,
    flexBasic: 0,
    ...shorthands.padding("10px"),
    display: "flex",
    minWidth: 0,
    minHeight: 0,
  },
  innerContainer: {
    display: "flex",
    flexDirection: "column",
    backgroundColor: "#fff",
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: "auto",
    ...shorthands.borderRadius("6px"),
    ...shorthands.overflow("hidden"),
  },
  innerContainerDescription: {},
  name: {
    ...shorthands.overflow("hidden"),
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  label: {
    display: "inline-block",
    ...shorthands.padding("5px", "10px"),
    ...shorthands.borderRadius("12px"),
    ...shorthands.borderStyle("none"),
  },
  centerDiv: {
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: "auto",
  },
});
