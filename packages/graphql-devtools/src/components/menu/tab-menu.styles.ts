import { makeStyles, shorthands } from "@fluentui/react-components";
import { keyboardFocusedStyle } from "../common.styles";

export const tabMenuStyles = makeStyles({
    root: {},
    tabMenuList: {
        display: "flex",
        listStyleType: "none",
        ...shorthands.borderBottom("1px", "solid", "#F5F5F5"),
        ...shorthands.padding(0, 0, "5px", 0),
        ...shorthands.margin(0, "15px"),
    },
    tabMenuItem: {
        marginRight: "15px",
        color: "#ABABAB",
        cursor: "pointer",
        position: "relative",
        "&:hover": {
            color: "#97CBFF"
        },
        ...keyboardFocusedStyle('-4px'),
    },
    tabMenuItemActive: {
        color: "#97CBFF",
        "&:before": {
            content: "''",
            position: "absolute",
            bottom: "-6px",
            width: '100%',
            height: "3px",
            backgroundColor: "#97CBFF",
        }
    }
});