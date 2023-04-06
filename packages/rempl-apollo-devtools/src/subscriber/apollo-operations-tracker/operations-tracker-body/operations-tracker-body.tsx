import * as React from "react";
import { TabList, Tab } from "@fluentui/react-components";
import { IDataView } from "apollo-inspector";
import { TabHeaders } from "../../../types";
import { VerboseOperationsContainer } from "../verbose-operation/verbose-operations-container";
import { useStyles } from "./operations-tracker-body-styles";
import {
  ICountReducerState,
  ICountReducerAction,
  CountReducerActionEnum,
} from "./operations-tracker-body.interface";
import { AffectedQueriesContainer } from "../affected-queries";
import {
  IOperationsAction,
  IOperationsReducerState,
} from "../operations-tracker-container-helper";

export interface IOperationViewRendererProps {
  selectedTab: TabHeaders;
  data: IDataView;
  operationsState: IOperationsReducerState;
  dispatchOperationsCount: React.Dispatch<ICountReducerAction>;
  dispatchOperationsState: React.Dispatch<IOperationsAction>;
}

export interface IOperationViewContainer {
  data: IDataView | null;
  operationsState: IOperationsReducerState;
  dispatchOperationsState: React.Dispatch<IOperationsAction>;
}

const tabHeaders = [
  { key: TabHeaders.AllOperationsView, name: "All operations" },
  { key: TabHeaders.OperationsView, name: "Only Cache operations" },
  { key: TabHeaders.VerboseOperationView, name: "Operations" },
  { key: TabHeaders.AffectedQueriesView, name: "Affected Queries" },
];

export const OperationsTrackerBody = (props: IOperationViewContainer) => {
  const { data, operationsState, dispatchOperationsState } = props;
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
      (tabHeader) =>
        tabHeader.key === TabHeaders.VerboseOperationView ||
        tabHeader.key === TabHeaders.AffectedQueriesView,
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
        operationsState={operationsState}
        dispatchOperationsCount={dispatchOperationsCount}
        dispatchOperationsState={dispatchOperationsState}
      />
    </div>
  );
};

const OperationsViewRenderer = (props: IOperationViewRendererProps) => {
  const {
    selectedTab,
    data,
    operationsState,
    dispatchOperationsCount,
    dispatchOperationsState,
  } = props;

  switch (selectedTab) {
    case TabHeaders.VerboseOperationView: {
      return (
        <VerboseOperationsContainer
          operations={data.verboseOperations}
          operationsState={operationsState}
          dispatchOperationsCount={dispatchOperationsCount}
          dispatchOperationsState={dispatchOperationsState}
        />
      );
    }

    case TabHeaders.AffectedQueriesView: {
      return (
        <AffectedQueriesContainer
          affectedQueries={data.affectedQueriesOperations}
        />
      );
    }

    default: {
      return null;
    }
  }
};

const getCount = (key: TabHeaders, data: ICountReducerState) => {
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
  state: ICountReducerState,
  action: ICountReducerAction,
): ICountReducerState => {
  switch (action.type) {
    case CountReducerActionEnum.UpdateAllOperationsCount: {
      return { ...state, allOperationsCount: action.value };
    }
    case CountReducerActionEnum.UpdateCacheOperationsCount: {
      return { ...state, cacheOperationsCount: action.value };
    }
    case CountReducerActionEnum.UpdateVerboseOperationsCount: {
      return { ...state, verboseOperationsCount: action.value };
    }

    default: {
      return state;
    }
  }
};

const computeInitialReducerState = (
  data: IDataView | null,
): ICountReducerState => {
  return {
    allOperationsCount: data?.allOperations?.length || 0,
    verboseOperationsCount: data?.verboseOperations?.length || 0,
    cacheOperationsCount: data?.operations?.length || 0,
  };
};
