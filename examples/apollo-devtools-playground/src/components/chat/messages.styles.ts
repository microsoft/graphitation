import { makeStyles, shorthands } from "@fluentui/react-components";

export const useMessagesStyles = makeStyles({
  itemContainer: {
    display: "grid",
    gridTemplateColumns: "auto 450px 150px",
    alignItems: "center",
    ...shorthands.padding("10px", "20px"),
    ...shorthands.borderBottom("1px", "solid", "#F5F5F5"),
    "&:hover": {
      backgroundColor: "#F5F5F6",
    },
  },
  idColumn: {
    ...shorthands.overflow("hidden"),
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  button: {
    minWidth: "auto",
    height: "auto",
    ...shorthands.padding("3px", "12px"),
  },
});
