import { makeStyles, shorthands, tokens } from "@fluentui/react-components";

export const useHistoryDetailsStyles = makeStyles({
  root: {
    display: "flex",
    flexDirection: "column",
    height: "100%",
    ...shorthands.overflow("hidden"),
  },
  scrollContainer: {
    ...shorthands.flex(1),
    overflowY: "auto",
    ...shorthands.padding(tokens.spacingHorizontalM),
    minHeight: 0,
  },
  content: {
    display: "flex",
    flexDirection: "column",
    ...shorthands.gap(tokens.spacingVerticalM),
    ...shorthands.padding(
      tokens.spacingVerticalM,
      0,
      tokens.spacingVerticalXXL,
      0,
    ),
  },
  header: {
    display: "flex",
    flexDirection: "column",
    ...shorthands.gap(tokens.spacingVerticalS),
    ...shorthands.padding(0, 0, tokens.spacingVerticalL, 0),
    ...shorthands.borderBottom(
      tokens.strokeWidthThin,
      "solid",
      tokens.colorNeutralStroke1,
    ),
  },
  badges: {
    display: "flex",
    ...shorthands.gap(tokens.spacingHorizontalS),
    flexWrap: "wrap",
  },
  section: {
    display: "flex",
    flexDirection: "column",
    ...shorthands.gap(tokens.spacingVerticalXS),
  },
  sectionHeaderWithSwitch: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    ...shorthands.gap(tokens.spacingHorizontalM),
    width: "100%",
  },
  missingFieldsSection: {
    display: "flex",
    flexDirection: "column",
    ...shorthands.gap(tokens.spacingVerticalM),
  },
  warningBanner: {
    display: "flex",
    flexDirection: "column",
    ...shorthands.gap(tokens.spacingVerticalS),
    backgroundColor: tokens.colorStatusWarningBackground2,
    color: tokens.colorStatusWarningForeground2,
    ...shorthands.borderRadius(tokens.borderRadiusMedium),
    ...shorthands.padding(tokens.spacingVerticalS, tokens.spacingHorizontalM),
    ...shorthands.border(
      tokens.strokeWidthThin,
      "solid",
      tokens.colorStatusWarningBorder1,
    ),
  },
  warningBannerToggle: {
    display: "flex",
    flexDirection: "column",
    ...shorthands.gap(tokens.spacingVerticalXXS),
    cursor: "pointer",
    textAlign: "left",
    color: "inherit",
    width: "100%",
    backgroundColor: "transparent",
    ...shorthands.padding(0),
    ...shorthands.border(0, "solid", "transparent"),
    ...shorthands.borderRadius(tokens.borderRadiusSmall),
    selectors: {
      "&:hover": {
        opacity: 0.96,
      },
    },
    "&:focus-visible": {
      outlineStyle: "solid",
      outlineWidth: tokens.strokeWidthThin,
      outlineColor: tokens.colorStatusWarningBorder1,
    },
  },
  warningBannerHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    width: "100%",
  },
  warningBannerHeaderLeft: {
    display: "flex",
    alignItems: "center",
    ...shorthands.gap(tokens.spacingHorizontalS),
    flexGrow: 1,
  },
  warningBannerContent: {
    display: "flex",
    flexDirection: "column",
    ...shorthands.gap(tokens.spacingVerticalS),
  },
  dataSection: {
    display: "flex",
    flexDirection: "column",
    ...shorthands.gap(tokens.spacingVerticalXS),
    ...shorthands.borderTop(
      tokens.strokeWidthThin,
      "solid",
      tokens.colorNeutralStroke2,
    ),
    ...shorthands.padding(tokens.spacingVerticalS, 0, 0, 0),
    selectors: {
      "&:first-of-type": {
        borderTopStyle: "none",
        paddingTop: 0,
      },
    },
  },
  dataSectionHeader: {
    ...shorthands.flex(1),
  },
  dataSectionCaption: {
    color: tokens.colorNeutralForeground4,
    fontSize: tokens.fontSizeBase200,
  },
  warningIcon: {
    color: tokens.colorStatusWarningForeground2,
    fontSize: tokens.fontSizeBase400,
  },
  warningChevron: {
    color: tokens.colorStatusWarningForeground2,
    ...shorthands.transition("transform", "0.2s", "ease-in-out"),
  },
  warningChevronExpanded: {
    transform: "rotate(90deg)",
  },
});
