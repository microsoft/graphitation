import { makeStyles } from "@fluentui/react-components";

export const useStyles = makeStyles({
  filterView: {
    display: "flex",
    flexDirection: "column",
    overflowY: "scroll",
    paddingLeft: "10px",
    backgroundColor: "#d6d6d6",
    paddingRight: "10px",
    height: "100%",
    "::-webkit-scrollbar": {
      display: "none",
    },
  },
  filters: {
    display: "flex",
    alignItems: "center",
    borderBottom: "0.5px solid grey" as any,
  },
  type: {
    display: "flex",
    flexDirection: "column",
    borderBottom: "0.5px solid grey" as any,
    paddingBottom: "10px",
  },
  operationType: {
    display: "flex",
    flexDirection: "column",
    borderBottom: "0.5px solid grey" as any,
    paddingBottom: "10px",
  },
});
