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
    gridTemplateRows: "50px 0 auto",
    height: "100%",
    backgroundColor: "#fff",
    ...shorthands.borderRadius("6px"),
    ...shorthands.overflow("hidden"),
  },
  innerContainerDescription: {
    gridTemplateRows: "50px 50px auto",
  },
  header: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    ...shorthands.padding("10px", "15px"),
  },
  searchContainer: {
    display: "flex",
    justifyContent: "flex-end",
    minWidth: "200px",
  },
  infoButton: {
    minWidth: "auto",
    marginRight: "5px",
    ...shorthands.padding(0, "5px"),
    "&:hover": {
      color: "#97CBFF",
    },
  },
  description: {
    ...shorthands.padding("5px", "15px"),
    visibility: "hidden",
    height: 0,
  },
  openDescription: {
    visibility: "visible",
    height: "auto",
    ...shorthands.overflow("hidden", "auto"),
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
  changed: {
    backgroundColor: "#F4E2A0",
    color: "#E3BB22",
    width: "60px",
  },
  time: {
    color: "#9d9da0",
  },
});
