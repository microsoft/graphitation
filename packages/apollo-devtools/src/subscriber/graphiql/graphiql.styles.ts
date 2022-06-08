import { makeStyles, shorthands } from "@fluentui/react-components";

export const qraphiqlStyles = makeStyles({
  root: {
    flexShrink: 1,
    flexGrow: 1,
    flexBasic: 0,
    height: "100%",
    ...shorthands.padding("10px"),
  },
  innerContainer: {
    height: "100%",
    backgroundColor: "#fff",
    ...shorthands.borderRadius("6px"),
    ...shorthands.overflow("auto"),
  },
});
