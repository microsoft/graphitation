import { makeStyles, shorthands } from "@fluentui/react-components";

export const useStyles = makeStyles({
  header: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    ...shorthands.padding("10px", "15px"),
  },
  infoButton: {
    minWidth: "auto",
    marginRight: "5px",
    ...shorthands.padding(0, "5px"),
    "&:hover": {
      color: "#97CBFF",
    },
  },
  description: {
    ...shorthands.padding("0px", "15px"),
  },
  openDescription: {
    visibility: "visible",
    height: "auto",
    ...shorthands.overflow("hidden", "auto"),
  },
});
