import { makeStyles, shorthands } from "@fluentui/react-components";

export const useStyles = makeStyles({
  gridBody: {
    position: "relative",
    willChange: "transform",
    direction: "ltr",
    cursor: "pointer",
    width: "100%",
    height: "100%",
    overflowY: "scroll",
    "::-webkit-scrollbar": {
      display: "none",
    },
  },
  gridRow: {
    ":hover": {
      backgroundColor: "unset",
      color: "unset",
    },
  },
  gridHeader: {
    ":hover": {
      backgroundColor: "unset !important",
      color: "unset !important",
    },
  },
  gridView: {
    minWidth: 0,
    height: "100%",
    flexGrow: 2,
    display: "flex",
    "&:hover": {
      backgroundColor: "unset !important",
      color: "unset !important",
    },
  },
  selectedAndFailedRow: {
    color: "darkred",
    backgroundColor: "darkgrey",
    fontWeight: "bold",
    "&:hover": {
      backgroundColor: "darkgrey",
      color: "darkred",
    },
  },
  failedRow: {
    "&:hover": {
      backgroundColor: "unset",
      color: "red",
    },
    color: "red",
  },
  selectedRow: {
    backgroundColor: "darkgrey",
    color: "white",
    fontWeight: "bold",
    "&:hover": {
      backgroundColor: "darkgrey",
      color: "white",
    },
  },
  operationText: {
    ...shorthands.overflow("hidden"),
    display: "block",
  },
  selectedOperationGridWrapper: {
    minWidth: 0,
    flexGrow: 2,
  },
  gridWrapper: {
    flexGrow: 2,
  },
  filterViewWrapper: {
    flexGrow: 1,
    minWidth: 0,
  },
});
