import { makeStyles, shorthands } from "@fluentui/react-components";

export const dialogStyles = makeStyles({
  root: {
    display: "flex",
    position: "fixed",
    top: 0,
    left: 0,
    alignItems: "center",
    justifyContent: "center",
    width: "100%",
    height: "100%",
    backgroundColor: "rgba(0, 0, 0, 0.3)",
    zIndex: 2,
  },
  dialogContainer: {
    display: "grid",
    gridAutoFlow: "column",
    gridTemplateRows: "40px auto",
    width: "70%",
    maxWidth: "calc(100% - 60px)",
    minWidth: "400px",
    height: "75%",
    maxHeight: "100%",
    minHeight: "335px",
    backgroundColor: "#fff",
    ...shorthands.borderRadius("6px"),
    ...shorthands.padding("15px"),
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
  },
  closeButton: {
    marginLeft: "10px",
    cursor: "pointer",
    minWidth: "auto",
  },
  details: {
    ...shorthands.overflow("hidden", "auto"),
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
