import * as React from "react";
import { TabList, Tab } from "@fluentui/react-components";
import { IDataView } from "apollo-inspector";
import { TabHeaders } from "../../../types";
import { VerboseOperationsContainer } from "../verbose-operation/verbose-operations-container";
import { useStyles } from "./operations-tracker-body-styles";
import {
  IReducerState,
  IReducerAction,
  ReducerActionEnum,
} from "./operations-tracker-body.interface";

export interface IOperationViewRendererProps {
  selectedTab: TabHeaders;
  data: IDataView;
  filter: string;
  dispatchOperationsCount: React.Dispatch<IReducerAction>;
}

export interface IOperationViewContainer {
  data: IDataView | null;
  filter: string;
}

const tabHeaders = [
  { key: TabHeaders.AllOperationsView, name: "All operations" },
  { key: TabHeaders.OperationsView, name: "Only Cache operations" },
  { key: TabHeaders.VerboseOperationView, name: "Verbose operations" },
  { key: TabHeaders.AffectedQueriesView, name: "Affected Queries" },
];

export const OperationsTrackerBody = (props: IOperationViewContainer) => {
  const { data, filter } = props;
  const [selectedTab, setSelectedTab] = React.useState(
    TabHeaders.VerboseOperationView,
  );
  const initialState = React.useMemo(() => {
    return computeInitialReducerState(data);
  }, [data]);
  const [state, dispatchOperationsCount] = React.useReducer(
    reducer,
    initialState,
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
          {`${item.name} ${
            item.key === TabHeaders.AffectedQueriesView
              ? ``
              : `(${getCount(item.key, state)})`
          }`}
        </Tab>
      );
    });
    return items;
  }, [updatedTabItems, state]);

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
      <OperationsViewRenderer
        data={data}
        selectedTab={selectedTab}
        filter={filter}
        dispatchOperationsCount={dispatchOperationsCount}
      />
    </div>
  );
};

const OperationsViewRenderer = (props: IOperationViewRendererProps) => {
  const { selectedTab, data, filter, dispatchOperationsCount } = props;

  switch (selectedTab) {
    case TabHeaders.VerboseOperationView: {
      return (
        <VerboseOperationsContainer
          operations={data.verboseOperations}
          filter={filter}
          dispatchOperationsCount={dispatchOperationsCount}
        />
      );
    }

    default: {
      return null;
    }
  }
};

const getCount = (key: TabHeaders, data: IReducerState) => {
  switch (key) {
    case TabHeaders.VerboseOperationView: {
      return data.verboseOperationsCount;
    }
    case TabHeaders.OperationsView: {
      return data.cacheOperationsCount;
    }
    case TabHeaders.AllOperationsView: {
      return data.allOperationsCount;
    }

    default: {
      return 0;
    }
  }
};

const reducer = (
  state: IReducerState,
  action: IReducerAction,
): IReducerState => {
  switch (action.type) {
    case ReducerActionEnum.UpdateAllOperationsCount: {
      return { ...state, allOperationsCount: action.value };
    }
    case ReducerActionEnum.UpdateCacheOperationsCount: {
      return { ...state, cacheOperationsCount: action.value };
    }
    case ReducerActionEnum.UpdateVerboseOperationsCount: {
      return { ...state, verboseOperationsCount: action.value };
    }

    default: {
      return state;
    }
  }
};

const computeInitialReducerState = (data: IDataView | null): IReducerState => {
  return {
    allOperationsCount: data?.allOperations?.length || 0,
    verboseOperationsCount: data?.verboseOperations?.length || 0,
    cacheOperationsCount: data?.operations?.length || 0,
  };
};
