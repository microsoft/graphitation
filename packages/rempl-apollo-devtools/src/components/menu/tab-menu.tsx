import React from "react";
import { tabMenuStyles } from "./tab-menu.styles";
import { mergeClasses } from "@fluentui/react-components";
import { useArrowNavigationGroup } from "@fluentui/react-tabster";

interface TabMenuProps {
  currentType: string;
  onSelectItem: (cacheType: string) => void;
}

const tabMenuItems = [
  {
    name: "all",
    title: "All cache",
  },
  {
    name: "duplicated",
    title: "Duplicated cache",
  },
];

export const TabMenu = React.memo(
  ({ currentType, onSelectItem }: TabMenuProps) => {
    const classes = tabMenuStyles();
    const menuAttributes = useArrowNavigationGroup({
      circular: true,
      axis: "horizontal",
    });

    return (
      <nav className={classes.root}>
        <ul className={classes.tabMenuList} {...menuAttributes}>
          {tabMenuItems.map((elem) => (
            <li
              className={mergeClasses(
                classes.tabMenuItem,
                currentType === elem.name && classes.tabMenuItemActive,
              )}
              tabIndex={0}
              onClick={() => onSelectItem(elem.name)}
              onKeyDown={(e) => {
                if (e.key === "Enter") onSelectItem(elem.name);
              }}
            >
              {elem.title}
            </li>
          ))}
        </ul>
      </nav>
    );
  },
);
