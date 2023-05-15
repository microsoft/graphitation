import { makeStyles, shorthands, tokens } from "@fluentui/react-components";

export const useChatRendererStyles = makeStyles({
  title: {
    ...shorthands.padding("15px"),
  },
  inputContainer: {
    display: "flex",
    ...shorthands.padding("15px"),
  },
  input: {
    display: "inline-block",
    boxSizing: "border-box",
    width: "300px",
    height: "32px",
    marginRight: "20px",
    ...shorthands.padding(0, 0, 0, "5px"),
    ...shorthands.border("1px", "solid", tokens.colorNeutralBackground2Pressed),
    ...shorthands.borderRadius("6px"),
    outlineStyle: "none",
    "&:focus": {
      ...shorthands.borderColor("#97CBFF"),
    },
  },
});
