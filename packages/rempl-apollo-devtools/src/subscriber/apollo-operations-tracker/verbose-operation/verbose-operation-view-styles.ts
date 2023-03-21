import { makeStyles } from "@fluentui/react-components";

export const useStyles = makeStyles({
  operationView: {
    display: "flex",
    flexDirection: "column",
    minHeight: 0,
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: "auto",
    backgroundColor: "darkgrey",
    minWidth: 0,
    color: "black",
  },
  operationNameAccPanel: {
    whiteSpace: "pre-wrap",
    marginLeft: "1rem",
  },
  operationVariablesAccPanel: {
    whiteSpace: "pre-wrap",
    marginLeft: "1rem",
  },
  durationAccPanel: {
    marginLeft: "1rem",
    display: "flex",
    flexDirection: "column",
  },
  fetchPolicyAccPanel: { marginLeft: "1rem" },
  errorAccPanel: { marginLeft: "1rem" },
  warningAccPanel: { marginLeft: "1rem" },
  resultPanel: {
    whiteSpace: "pre-wrap",
  },
  affectedQueriesAccPanel: {
    marginLeft: "1rem",
    display: "flex",
    flexDirection: "column",
  },
  operationDetails: {
    minHeight: 0,
    overflowY: "auto",
    "::-webkit-scrollbar": {
      display: "none",
    },
  },
  operationName: {
    display: "flex",
    flexDirection: "column",
  },
  copyBtn: {
    minHeight: "32px",
    marginLeft: "1rem",
  },
  subHeading: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    height: "32.5px",
    backgroundColor: "#e0e0e0",
  },

  closeButton: {
    width: "40px",
    marginRight: "10px",
  },
  accordionWrapper: {
    minHeight: 0,
    overflowX: "scroll",
  },
  accordioPreWrapper: {
    maxWidth: "40rem",
  },
});

export type stylesKeys =
  | "operationView"
  | "operationNameAccPanel"
  | "operationVariablesAccPanel"
  | "durationAccPanel"
  | "fetchPolicyAccPanel"
  | "errorAccPanel"
  | "warningAccPanel"
  | "affectedQueriesAccPanel"
  | "operationDetails"
  | "operationName"
  | "resultPanel";
