import { makeStyles, shorthands } from "@fluentui/react-components";

export const searchStyles = makeStyles({
  root: {
    position: "relative",
    width: "90%",
    maxWidth: "300px",
    color: "#646464",
  },
  input: {
    display: "inline-block",
    boxSizing: "border-box",
    width: "100%",
    height: "32px",
    ...shorthands.padding(0, 0, 0, "30px"),
    backgroundColor: "#F5F5F6",
    ...shorthands.border("2px", "solid", "transparent"),
    ...shorthands.borderRadius("6px"),
    outlineStyle: "none",
    "&:focus": {
      ...shorthands.borderColor("#97CBFF"),
    },
  },
  icon: {
    position: "absolute",
    top: "5px",
    left: "5px",
  },
});
