import { makeStyles, shorthands } from "@fluentui/react-components";
import { keyboardFocusedStyle } from "../common.styles";

export const useStyles = makeStyles({
  container: {
    display: "flex",
    alignItems: "center",
    ...shorthands.padding("0.5rem", "0.5rem", 0),
  },
  dropdown: {
    position: "relative",
    width: "200px",
    height: "32px",
    backgroundColor: "#E9E8E8",
    marginLeft: "10px",
    ...shorthands.borderRadius("6px"),
  },
  dropdownValue: {
    width: "100%",
    height: "100%",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    cursor: "pointer",
    ...shorthands.padding(0, "15px"),
    boxSizing: "border-box",
    ...keyboardFocusedStyle("0"),
  },
  dropdownContent: {
    display: "none",
    position: "absolute",
    top: "32px",
    left: 0,
    right: 0,
    zIndex: 5,
    backgroundColor: "#fff",
    ...shorthands.border("1px", "solid", "#F5F5F5"),
    ...shorthands.borderRadius("6px"),
  },
  dropdownContentOpen: {
    display: "block",
  },
  dropdownItem: {
    ...shorthands.padding("10px", "15px"),
    cursor: "pointer",
    "&:hover": {
      backgroundColor: "#F5F5F6",
    },
    ...keyboardFocusedStyle("0"),
  },
});
