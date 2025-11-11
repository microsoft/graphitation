import { makeStyles, shorthands, tokens } from "@fluentui/react-components";

export const useHistoryDialogStyles = makeStyles({
  overlay: {
    position: "fixed",
    top: 0,
    left: 0,
    width: "100%",
    height: "100%",
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 1000,
  },
  dialog: {
    backgroundColor: tokens.colorNeutralBackground1,
    ...shorthands.borderRadius(tokens.borderRadiusLarge),
    maxWidth: "95vw",
    width: "1400px",
    maxHeight: "90vh",
    display: "grid",
    gridTemplateRows: "auto 1fr",
    boxShadow: tokens.shadow64,
    ...shorthands.overflow("hidden"),
  },
  contentContainer: {
    display: "grid",
    gridTemplateColumns: "300px 1fr",
    ...shorthands.overflow("hidden"),
    height: "80vh",
  },
  detailsPanel: {
    ...shorthands.overflow("hidden"),
    height: "100%",
  },
});
