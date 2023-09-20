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
    width: "50%",
    maxWidth: "calc(100% - 60px)",
    minWidth: "400px",
    height: "50%",
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
  name: {
    wordBreak: "break-all",
  },
  closeButton: {
    marginLeft: "10px",
    cursor: "pointer",
    minWidth: "auto",
  },
  description: {
    display: "block",
    color: "#57a8f9",
  },
  contentPre: {
    display: "flex",
    verticalAlign: "flex-start",
    ...shorthands.overflow("auto"),
    flexShrink: 1,
    flexGrow: 1,
    flexBasis: 0,
    height: "calc(100% - 35px)",
  },
  preStyles: {
    marginTop: 0,
    fontSize: "0.75rem",
  },
});
