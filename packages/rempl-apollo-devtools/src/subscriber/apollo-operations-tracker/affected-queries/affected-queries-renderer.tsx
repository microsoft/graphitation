import * as React from "react";
import {
  TabList,
  Tab,
  SelectTabEvent,
  SelectTabData,
  Text,
} from "@fluentui/react-components";
import { AffectedQueriesGridRenderers } from "./affected-queries-grid-renderer";
import { IDueToOperation } from "apollo-inspector";
import { useStyles } from "./affected-queries-renderer-styles";

export interface IAffectedQueriesRendererProps {
  listOfItems: any[];
  gridItems: IDueToOperation[] | undefined;
  selectedListItem: string;
  onTabSelect: (event: SelectTabEvent, data: SelectTabData) => void;
}

export const AffectedQueriesRenderer = (
  props: IAffectedQueriesRendererProps,
) => {
  const { listOfItems, gridItems, selectedListItem, onTabSelect } = props;
  const classes = useStyles();
  const tabItems = listOfItems.map((element: any) => {
    return (
      <Tab key={element.name} value={element.name}>
        {element.value}
      </Tab>
    );
  });
  return (
    <div className={classes.root}>
      <TabList
        selectedValue={selectedListItem}
        onTabSelect={onTabSelect}
        vertical={true}
      >
        {tabItems}
      </TabList>
      <div className={classes.rightPane}>
        <div className={classes.rightPaneHeader}>
          <Text weight="bold" size={300}>{`${selectedListItem}`}</Text>
          <span>&nbsp;</span>
          <Text
            size={300}
          >{`is re-rendered due to following operations in the table`}</Text>
        </div>
        <AffectedQueriesGridRenderers items={gridItems} />
      </div>
    </div>
  );
};
