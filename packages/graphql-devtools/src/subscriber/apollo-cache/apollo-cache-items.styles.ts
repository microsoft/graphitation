import { makeStyles, shorthands } from "@fluentui/react-components";

export const useStyles = makeStyles({
  root: {
    display: "flex",
    flexDirection: "column",
    height: "calc(100% - 105px)",
    ...shorthands.padding(0, "15px"),
    ...shorthands.overflow("hidden", "auto"),
  },
  detailsContainer: {
    ...shorthands.overflow("hidden"),
    ...shorthands.borderTop("1px", "solid", "#E1DFDD"),
    ...shorthands.padding("1rem"),
  },
  preStyles: {
    marginTop: 0,
    fontSize: "0.75rem",
  },
  itemContainer: {
    display: "grid",
    gridTemplateColumns: "auto 80px 100px",
    alignItems: "center",
    ...shorthands.padding("10px"),
    ...shorthands.borderBottom("1px", "solid", "#F5F5F5"),
    "&:hover": {
      backgroundColor: "#F5F5F6",
    },
  },
  keyColumn: {
    ...shorthands.overflow("hidden"),
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  actionButton: {
    minWidth: "auto",
    height: "auto",
    ...shorthands.padding("3px", "12px"),
    ...shorthands.borderStyle("none"),
  },
  detailsButton: {
    backgroundColor: "#e6f8e8",
    color: "#97D4A9",
    marginRight: "7px",
    "&:hover": {
      backgroundColor: "#cef0d2",
      color: "#7fae8d",
    },
  },
  removeButton: {
    backgroundColor: "#f8edea",
    color: "#F9B9B3",
    "&:hover": {
      backgroundColor: "#f5e2dd",
      color: "#d39089",
    },
  },
});
