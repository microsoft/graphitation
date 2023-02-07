import * as React from "react";
import { TabList, Tab } from "@fluentui/react-components";
import { IDataView } from "apollo-inspector";
import { TabHeaders } from "../../../types";
import { VerboseOperationsListViewRenderer } from "../verbose-operation/verbose-operations-list-view-renderer";
import { useStyles } from "./operations-list-view-container-styles";

export interface IOperationViewRendererProps {
  data: IDataView;
  selectedTab: TabHeaders;
}

export interface IOperationViewContainer {
  data: IDataView | null;
}

const tabHeaders = [
  { key: TabHeaders.AllOperationsView, name: "All operations" },
  { key: TabHeaders.OperationsView, name: "Only Cache operations" },
  { key: TabHeaders.VerboseOperationView, name: "Verbose operations" },
  { key: TabHeaders.AffectedQueriesView, name: "Affected Queries" },
];

export const OperationsListViewContainer = (props: IOperationViewContainer) => {
  const { data } = props;
  const [selectedTab, setSelectedTab] = React.useState(
    TabHeaders.VerboseOperationView,
  );
  const classes = useStyles();
  const updatedTabItems = React.useMemo(() => {
    const newTabHeaders = tabHeaders.filter(
      (tabHeader) => tabHeader.key === TabHeaders.VerboseOperationView,
    );

    return newTabHeaders;
  }, []);

  const tabs = React.useMemo(() => {
    const items = updatedTabItems.map((item) => {
      return (
        <Tab key={item.key} value={item.key}>
          {item.name}
        </Tab>
      );
    });
    return items;
  }, [updatedTabItems]);

  const onTabSelect = React.useCallback((_, props) => {
    setSelectedTab(props.value);
  }, []);

  if (!data) return null;
  return (
    <div className={classes.root}>
      <TabList
        className={classes.operationTabList}
        defaultSelectedValue={updatedTabItems[0].key}
        onTabSelect={onTabSelect}
        selectedValue={selectedTab}
        key="tabListOperations"
      >
        {tabs}
      </TabList>
      <OperationViewRenderer data={data} selectedTab={selectedTab} />
    </div>
  );
};

const OperationViewRenderer = (props: IOperationViewRendererProps) => {
  const { selectedTab, data } = props;
  switch (selectedTab) {
    case TabHeaders.VerboseOperationView: {
      return (
        <VerboseOperationsListViewRenderer
          operations={data.verboseOperations}
        />
      );
    }

    default: {
      return null;
    }
  }
};
