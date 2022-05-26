import { makeStyles, shorthands } from "@fluentui/react-components";
import { keyboardFocusedStyle } from "../common.styles";

export const useStyles = makeStyles({
  root: {
    width: "100%",
    ...shorthands.overflow("hidden"),
    maxWidth: "220px",
  },
  fill: {
    maxWidth: "auto"
  },
  hidden: {
    width: "0",
  },
  searchContainer: {
    width: "100%",
    display: "flex",
    justifyContent: "center",
    ...shorthands.padding("0.5rem", 0),
  },
  list: {
    overflowY: "auto",
    listStyleType: "none",
    ...shorthands.margin(0),
    ...shorthands.padding("5px"),
    height: "calc(100% - 48px)",
    boxSizing: "border-box"
  },
  listItem: {
    position: "relative",
    cursor: "pointer",
    marginBottom: "3px",
    ...shorthands.padding("10px"),
    ...shorthands.borderRadius("6px"),
    ...shorthands.overflow("hidden"),
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    "&:hover": {
      backgroundColor: "#F5F5F6",
      color: "#000",
    },
    ...keyboardFocusedStyle('0'),
  },
  listItemActive: {
    backgroundColor: "#F5F5F6",
  },
});
