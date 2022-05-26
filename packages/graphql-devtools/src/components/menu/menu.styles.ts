import { makeStyles, shorthands } from "@fluentui/react-components";
import { keyboardFocusedStyle } from "../common.styles";

export const menuStyles = makeStyles({
  root: {
    position: "relative",
    minWidth: "75px",
    width: "75px",
    ...shorthands.overflow("hidden"),
  },
  menuList: {
    maxHeight: "100%",
    listStyleType: "none",
    ...shorthands.overflow("auto"),
    ...shorthands.margin("-15px", "-5px", "-15px", 0),
    ...shorthands.padding("15px", "5px"),
  },
  menuItem: {
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
    position: "relative",
    alignItems: "center",
    color: "#919191",
    textDecorationLine: "none",
    ...shorthands.padding("5px", "12px"),
    ...shorthands.margin("3px", 0),
    ...shorthands.borderRadius("6px"),
    "&:hover": {
      color: "#757575",
      backgroundColor: "#EAEAEA",
    },
    ...keyboardFocusedStyle("0"),
  },
  menuItemActive: {
    backgroundColor: "#fff",
    color: "#242424",
  },
  menuItemIcon: {
    width: "20px",
    display: "flex",
  },
  menuText: {
    fontSize: "11px",
    lineHeight: 1.5,
    textAlign: "center",
  },
  badge: {
    position: "absolute",
    top: "-3px",
    right: "1px",
  },
});
