import { makeStyles, shorthands } from "@fluentui/react-components";

export const useStyles = makeStyles({
  container: {
    width: "100%",
    height: "100%",
    display: "grid",
    gridAutoFlow: "column",
    gridTemplateRows: "50px auto",
    flexShrink: 1,
    flexGrow: 1,
    flexBasis: 0,
    ...shorthands.padding(0, "1rem"),
    boxSizing: "border-box",
  },
  header: {
    display: "flex",
    alignItems: "center",
    ...shorthands.padding("10px", 0),
  },
  title: {
    color: "#97CBFF",
  },
  details: {
    ...shorthands.overflow("hidden", "auto"),
  },
  controlButton: {
    minWidth: "auto",
    marginRight: "10px",
    ...shorthands.padding(0, "5px"),
  },
  codeBox: {
    width: "100%",
    backgroundColor: "#F5F5F6",
    fontSize: "11px",
    boxSizing: "border-box",
    ...shorthands.overflow("auto", "hidden"),
    ...shorthands.borderRadius("6px"),
    ...shorthands.padding("5px"),
    ...shorthands.margin("5px", 0),
  },
});
