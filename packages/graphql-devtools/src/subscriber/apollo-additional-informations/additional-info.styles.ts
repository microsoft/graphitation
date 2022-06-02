import { makeStyles, shorthands } from "@fluentui/react-components";

export const useStyles = makeStyles({
  root: {
    flexShrink: 1,
    flexGrow: 1,
    flexBasic: 0,
    height: "calc(100% - 15px)",
    ...shorthands.padding("10px"),
  },
  innerContainer: {
    height: "100%",
    backgroundColor: "#fff",
    ...shorthands.borderRadius("6px"),
    ...shorthands.overflow("auto"),
  },
  infoItem: {
    ...shorthands.padding("10px"),
    ...shorthands.borderBottom("1px", "solid", "#F5F5F5"),
    "&:hover": {
      backgroundColor: "#F5F5F6",
    },
  },
});
