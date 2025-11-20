import { makeStyles, shorthands, tokens } from "@fluentui/react-components";

/**
 * Common styles for dialog/modal overlays
 */
export const useDialogStyles = makeStyles({
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
    maxHeight: "90vh",
    display: "flex",
    flexDirection: "column",
    boxShadow: tokens.shadow64,
    ...shorthands.overflow("hidden"),
  },
  header: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    ...shorthands.gap(tokens.spacingHorizontalM),
    ...shorthands.padding(tokens.spacingVerticalL, tokens.spacingHorizontalL),
    ...shorthands.borderBottom(
      tokens.strokeWidthThin,
      "solid",
      tokens.colorNeutralStroke1,
    ),
    backgroundColor: tokens.colorNeutralBackground2,
  },
  content: {
    ...shorthands.flex(1),
    ...shorthands.overflow("hidden"),
  },
});

/**
 * Common styles for list items
 */
export const useListItemStyles = makeStyles({
  item: {
    ...shorthands.padding(tokens.spacingVerticalS, tokens.spacingHorizontalM),
    ...shorthands.margin(tokens.spacingVerticalXS, 0),
    ...shorthands.borderRadius(tokens.borderRadiusMedium),
    cursor: "pointer",
    ...shorthands.transition("all", "0.15s", "ease-in-out"),
    "&:hover": {
      backgroundColor: tokens.colorNeutralBackground1Hover,
    },
  },
  itemActive: {
    backgroundColor: tokens.colorBrandBackground2,
    "&:hover": {
      backgroundColor: tokens.colorBrandBackground2Hover,
    },
  },
});

/**
 * Common styles for code/monospace text
 */
export const useCodeStyles = makeStyles({
  code: {
    fontFamily: tokens.fontFamilyMonospace,
    fontSize: tokens.fontSizeBase200,
  },
  codeBlock: {
    fontFamily: tokens.fontFamilyMonospace,
    fontSize: tokens.fontSizeBase200,
    ...shorthands.padding(tokens.spacingVerticalS, tokens.spacingHorizontalS),
    backgroundColor: tokens.colorNeutralBackground3,
    ...shorthands.borderRadius(tokens.borderRadiusMedium),
    ...shorthands.border(
      tokens.strokeWidthThin,
      "solid",
      tokens.colorNeutralStroke2,
    ),
    overflowX: "auto",
    whiteSpace: "pre-wrap",
    wordBreak: "break-word",
  },
});

/**
 * Common styles for panels and sections
 */
export const usePanelStyles = makeStyles({
  panel: {
    display: "flex",
    flexDirection: "column",
    height: "100%",
    ...shorthands.overflow("hidden"),
  },
  panelHeader: {
    ...shorthands.padding(tokens.spacingVerticalM, tokens.spacingHorizontalM),
    ...shorthands.borderBottom(
      tokens.strokeWidthThin,
      "solid",
      tokens.colorNeutralStroke1,
    ),
    backgroundColor: tokens.colorNeutralBackground2,
  },
  panelContent: {
    ...shorthands.flex(1),
    overflowY: "auto",
    ...shorthands.padding(tokens.spacingVerticalM, tokens.spacingHorizontalM),
  },
});

/**
 * Common scrollbar styles
 */
export const useScrollbarStyles = makeStyles({
  customScrollbar: {
    "&::-webkit-scrollbar": {
      width: "8px",
      height: "8px",
    },
    "&::-webkit-scrollbar-track": {
      backgroundColor: tokens.colorNeutralBackground3,
    },
    "&::-webkit-scrollbar-thumb": {
      backgroundColor: tokens.colorNeutralStroke1,
      ...shorthands.borderRadius(tokens.borderRadiusSmall),
      "&:hover": {
        backgroundColor: tokens.colorNeutralStroke2,
      },
    },
  },
});
