import * as React from "react";
import { Input, Text, InputProps } from "@fluentui/react-components";
import { IVerboseOperation } from "apollo-inspector";
import debounce from "lodash.debounce";
import { useStyles } from "./search-styles";

export interface ISearchProps<T> {
  items: T[] | null;
  setFilteredItems: (items: T[] | null | undefined) => void;
}
export const Search = (props: ISearchProps<IVerboseOperation>) => {
  const { items, setFilteredItems } = props;
  const [value, setValue] = React.useState("");
  const classes = useStyles();

  const updateItems = React.useCallback(
    debounce((value: string) => {
      if (value.length === 0) {
        setFilteredItems(items);
      } else {
        const filteredItems = items?.filter((item) => {
          return (
            item.operationName?.toLowerCase().indexOf(value.toLowerCase()) != -1
          );
        });
        setFilteredItems(filteredItems);
      }
    }, 200),
    [],
  );

  const onChange: InputProps["onChange"] = React.useCallback(
    (ev, data) => {
      setValue(data.value);
      updateItems(data.value);
    },
    [setValue, updateItems],
  );

  return (
    <div className={classes.root}>
      <Text className={classes.searchText}>{`Search`}</Text>
      <Input
        appearance="outline"
        placeholder="Enter text to filter operations"
        size="medium"
        value={value}
        onChange={onChange}
      ></Input>
    </div>
  );
};
