import { makeStyles, shorthands } from "@fluentui/react-components";

export const useStyles = makeStyles({
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
    },
    topBar: {
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        ...shorthands.padding("10px", "15px"),
    },
    title: {
        textTransform: "capitalize",
    },
    actionsContainer: {
        display: "flex",
    },
    actionButton: {
        minWidth: "auto",
        marginRight: "10px",
        ...shorthands.padding(0, "5px"),
    },
    topBarActions: {
        display: "flex",
        ...shorthands.borderLeft("1px", "solid", "#E1DFDD"),
        paddingLeft: "0.5rem",
        marginRight: "-15px",
    },
    searchContainer: {
        display: "flex",
        minWidth: '200px',
        justifyContent: "flex-end",
    },
    activeRecord: {
        color: "#C4314B !important",
        backgroundColor: "rgba(196, 49, 75, 0.2) !important",
    },
    infoPanel: {
        width: "100%",
        position: "fixed",
        bottom: 0,
        backgroundColor: "rgba(151, 203, 255, .5)",
        ...shorthands.padding("5px")
    }
});