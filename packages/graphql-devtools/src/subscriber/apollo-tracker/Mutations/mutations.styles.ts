import { makeStyles, shorthands } from "@fluentui/react-components";

export const mutationsStyles = makeStyles({
    root: {
        flexShrink: 1,
        flexGrow: 1,
        flexBasic: 0,
        height: "calc(100% - 15px)",
        ...shorthands.padding("10px"),
    },
    innerContainer: {
        display: "grid",
        gridTemplateColumns: "175px auto",
        height: "100%",
        backgroundColor: "#fff",
        ...shorthands.borderRadius("6px"),
    },
    innerContainerFull: {
        gridTemplateColumns: "0 auto",
    },
    viewerContainer: {
        ...shorthands.overflow("hidden"),
        ...shorthands.borderLeft("1px", "solid", "#E1DFDD"),
    },
    error: {
        color: "red"
    }
});