/* eslint-disable no-prototype-builtins */
import * as React from "react";
import { IAffectedQueryMap, IDueToOperation } from "apollo-inspector";
import { AffectedQueriesRenderer } from "./affected-queries-renderer";
import { SelectTabData } from "@fluentui/react-components";

export interface IAffectedQueriesContainerProps {
  affectedQueries: IAffectedQueryMap | null;
}
export const AffectedQueriesContainer = (
  props: IAffectedQueriesContainerProps,
) => {
  const { affectedQueries } = props;
  const listOfItems = React.useMemo(
    () => getListOfItems(affectedQueries),
    [affectedQueries],
  );
  const [selectedItem, setSelectedItem] = React.useState<string>(
    (listOfItems && listOfItems.length > 0 && listOfItems[0].name) || "",
  );

  const gridItems = React.useMemo(
    () => getGridItems(affectedQueries, selectedItem),
    [affectedQueries, selectedItem],
  );

  const onTabSelect = React.useCallback(
    (_, { value }: SelectTabData) => {
      setSelectedItem(value as string);
    },
    [setSelectedItem],
  );

  return (
    <AffectedQueriesRenderer
      listOfItems={listOfItems}
      gridItems={gridItems}
      selectedListItem={selectedItem}
      onTabSelect={onTabSelect}
    />
  );
};

const getGridItems = (
  affectedQueries: IAffectedQueryMap | null,
  selectedItem: string,
): IDueToOperation[] | undefined => {
  if (affectedQueries) {
    return affectedQueries[selectedItem]?.dueToOperations;
  }

  return undefined;
};

const getListOfItems = (affectedQueries: IAffectedQueryMap | null) => {
  const items = [];
  for (const key in affectedQueries) {
    if (affectedQueries.hasOwnProperty(key)) {
      items.push({ name: key, value: key });
    }
  }

  return items;
};
