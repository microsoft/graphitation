import { makeStyles, shorthands } from "@fluentui/react-components";

export const useStyles = makeStyles({
  root: {
    flexShrink: 1,
    flexGrow: 1,
    flexBasic: 0,
    height: "calc(100% - 15px)",
    ...shorthands.padding("10px"),
  },
  innerContainer: {
    display: "grid",
    gridAutoFlow: "column",
    gridTemplateRows: "50px auto",
    height: "100%",
    backgroundColor: "#fff",
    ...shorthands.borderRadius("6px"),
    ...shorthands.overflow("hidden"),
  },
  header: {
    display: "flex",
    alignItems: "flex-end",
    ...shorthands.padding("10px", "15px"),
  },
  activityContainer: {
    height: "100%",
    ...shorthands.overflow("auto"),
  },
  activityItem: {
    display: "grid",
    alignItems: "center",
    gridTemplateColumns: "auto 90px 70px",
  },
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
  added: {
    backgroundColor: "#e6f8e8",
    color: "#97D4A9",
    width: "40px",
  },
  removed: {
    backgroundColor: "#f8edea",
    color: "#F9B9B3",
    width: "55px",
  },
  time: {
    color: "#9d9da0",
  },
});
