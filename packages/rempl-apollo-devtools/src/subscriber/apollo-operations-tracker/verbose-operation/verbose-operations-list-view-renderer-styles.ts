import { makeStyles } from "@fluentui/react-components";

export const useStyles = makeStyles({
  root: {
    display: "flex",
    minHeight: 0,
    flexDirection: "column",
  },
  operations: {
    display: "flex",
    minHeight: 0,
  },

  operationsList: {
    overflowY: "auto",
    marginRight: "1rem",
    minHeight: 0,
    height: "100%",
  },
  operationNameWrapper: {
    display: "flex",
    flexDirection: "column",
  },
  operationsNameListWrapper: {
    display: "flex",
    flexDirection: "column",
    minWidth: "19rem",
    maxWidth: "25rem",
  },
  opCountTxt: {
    marginBottom: "1rem",
    paddingLeft: "1rem",
  },
  copyAllOpBtn: {
    minHeight: "32px",
    marginRight: "1rem",
  },
  operationName: {
    textOverflow: "ellipsis",
    overflowX: "hidden",
    overflowY: "hidden",
    whiteSpace: "nowrap",
  },
});
