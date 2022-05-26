import { makeStyles, shorthands } from "@fluentui/react-components";

export const useStyles = makeStyles({
	root: {
		display: "flex",
		flexDirection: "column",
		height: "calc(100% - 65px)",
		...shorthands.padding(0, "15px"),
		...shorthands.overflow("hidden", "auto")
	},
	description: {
		...shorthands.padding("10px", "15px"),
	},
	accordionHeader: {
		"&:hover": {
			backgroundColor: "#F5F5F6"
		}
	},
	counter: {
		color: "#97CBFF",
		fontWeight: "semibold"
	},
	cacheItem: {
		display: "grid",
		width: "calc(100% - 20px)",
		gridTemplateColumns: "auto auto 40px",
		columnGap: "10px",
		alignItems: "center",
		...shorthands.padding("10px"),
		...shorthands.borderBottom("1px", "solid", "#F5F5F5"),
		"&:hover": {
			backgroundColor: "#F5F5F6"
		}
	},
	message: {
		...shorthands.overflow("hidden"),
		textOverflow: "ellipsis",
		whiteSpace: "nowrap"
	},
	detailsButton: {
		minWidth: "auto",
		height: "auto",
		...shorthands.padding("3px", "12px"),
		...shorthands.borderStyle("none"),
		backgroundColor: "#e6f8e8",
		color: "#97D4A9",
		"&:hover": {
			backgroundColor: "#cef0d2",
			color: "#7fae8d"
		}
	},
});
