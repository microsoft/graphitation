import { makeStyles } from "@fluentui/react-components";

export const useStyles = makeStyles({
  operationView: {
    display: "flex",
    flexDirection: "column",
    minHeight: 0,
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: "auto",
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
  },
  operationName: {
    display: "flex",
    flexDirection: "column",
  },
  copyBtn: {
    minHeight: "32px",
    marginLeft: "1rem",
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
