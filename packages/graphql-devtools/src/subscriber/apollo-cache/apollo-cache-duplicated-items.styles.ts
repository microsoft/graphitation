import { makeStyles, shorthands } from "@fluentui/react-components";

export const useStyles = makeStyles({
  root: {
    display: "flex",
    flexDirection: "column",
    height: "calc(100% - 65px)",
    ...shorthands.padding(0, "15px"),
    ...shorthands.overflow("hidden", "auto"),
  },
  accordionHeader: {
    "&:hover": {
      backgroundColor: "#F5F5F6",
    },
  },
  counter: {
    color: "#97CBFF",
    fontWeight: "semibold",
  },
  cacheItem: {
    display: "grid",
    gridTemplateColumns: "50% 50%",
    alignItems: "center",
    ...shorthands.padding("10px"),
    ...shorthands.borderBottom("1px", "solid", "#F5F5F5"),
    "&:hover": {
      backgroundColor: "#F5F5F6",
    },
  },
});
