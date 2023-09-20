import { makeStyles } from "@fluentui/react-components";

export const useStyles = makeStyles({
  root: {
    display: "flex",
    justifyContent: "space-between",
    minHeight: 0,
  },
  rightPane: {
    display: "flex",
    flexDirection: "column",
    minHeight: 0,
    marginRight: "2rem",
  },
  rightPaneHeader: {
    display: "flex",
    marginBottom: "0.5rem",
  },
});
