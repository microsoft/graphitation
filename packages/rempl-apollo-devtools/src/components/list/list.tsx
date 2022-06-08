import React, { useState } from "react";
import { useStyles } from "./list.styles";
import { Search } from "../search/search";
import { mergeClasses } from "@fluentui/react-components";
import { useArrowNavigationGroup } from "@fluentui/react-tabster";

interface ListProps {
  isExpanded?: boolean;
  items: any;
  selectedIndex?: number;
  search?: boolean;
  fill?: boolean;
}

function filterListItems(items: any[], searchValue: string) {
  if (!searchValue) return items;
  const filteredItems = [...items];

  return filteredItems.filter((value: any) => {
    return JSON.stringify(value.key).toLowerCase().includes(searchValue);
  });
}

export const List = React.memo(
  ({
    isExpanded = false,
    items,
    selectedIndex,
    search = true,
    fill = false,
  }: ListProps) => {
    const [searchValue, setSearchValue] = useState("");
    const classes = useStyles();
    const listAttributes = useArrowNavigationGroup({ circular: true });

    return (
      <div
        className={mergeClasses(
          classes.root,
          fill && classes.fill,
          isExpanded && classes.hidden,
        )}
      >
        {search && (
          <div className={classes.searchContainer}>
            <Search
              onSearchChange={(e: React.SyntheticEvent) => {
                const input = e.target as HTMLInputElement;
                setSearchValue(input.value);
              }}
            />
          </div>
        )}
        <ul className={classes.list} {...listAttributes}>
          {filterListItems(items, searchValue).map((item) => (
            <li
              tabIndex={0}
              className={mergeClasses(
                classes.listItem,
                selectedIndex === item.index && classes.listItemActive,
              )}
              key={item.key}
              onClick={() => item.onClick(item.index)}
              onKeyDown={(e) => {
                if (e.key === "Enter") item.onClick(item.index);
              }}
            >
              {item.content}
            </li>
          ))}
        </ul>
      </div>
    );
  },
);
