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
    width: "min(1400px, 95vw)",
    maxWidth: "95vw",
    height: "90vh",
    maxHeight: "90vh",
    display: "grid",
    gridTemplateRows: "auto 1fr",
    boxShadow: tokens.shadow64,
    ...shorthands.overflow("hidden"),
  },
  contentContainer: {
    display: "grid",
    gridTemplateColumns: "clamp(220px, calc(154px + 8.89vw), 320px) 1fr",
    ...shorthands.overflow("hidden"),
    minHeight: 0,
    minWidth: 0,
    "@media (max-width: 839px)": {
      gridTemplateColumns: "1fr",
      gridTemplateRows: "auto 1fr",
    },
  },
  detailsPanel: {
    display: "flex",
    flexDirection: "column",
    ...shorthands.overflow("hidden"),
    minHeight: 0,
  },
});
