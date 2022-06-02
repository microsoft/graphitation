import { GriffelStyle } from "@griffel/core";
// import { tokens } from "@fluentui/react-components";
import { shorthands } from "@griffel/react";

export const keyboardFocusedStyle: (inset: string) => GriffelStyle = (
  inset,
) => ({
  "&:focus-visible": {
    outlineStyle: "none",
    "&:after": {
      content: "''",
      position: "absolute",
      inset,
      ...shorthands.border("2px", "solid", "black"),
      ...shorthands.borderRadius("4px"),
    },
  },
});
