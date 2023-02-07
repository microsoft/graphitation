import * as React from "react";
import { TabList, Tab, Text, Tooltip } from "@fluentui/react-components";
import { IVerboseOperation } from "apollo-inspector";
import { useStyles } from "./verbose-operations-list-view-styles";
import {
  IReducerAction,
  ReducerActionEnum,
} from "../operations-tracker-body/operations-tracker-body.interface";

export interface IVerboseOperationViewRendererProps {
  operations: IVerboseOperation[] | null;
  filter: string;
  setSelectedOperation: React.Dispatch<
    React.SetStateAction<IVerboseOperation | undefined>
  >;
  selectedOperation: IVerboseOperation | undefined;
  dispatchOperationsCount: React.Dispatch<IReducerAction>;
}

export const VerboseOperationsListView = (
  props: IVerboseOperationViewRendererProps,
) => {
  const {
    operations,
    filter,
    selectedOperation,
    setSelectedOperation,
    dispatchOperationsCount,
  } = props;

  const [filteredOperations, setFilteredOperations] = React.useState<
    IVerboseOperation[] | null | undefined
  >(operations);

  const classes = useStyles();
  const tabListItems = useOperationListNames(filteredOperations, classes);

  const operationsMap = React.useMemo(() => {
    const map = new Map<number, IVerboseOperation>();
    filteredOperations?.forEach((op) => {
      map.set(op.id, op);
    });
    return map;
  }, [filteredOperations]);

  const onTabSelect = React.useCallback(
    (_, props) => {
      const operation = operationsMap.get(props.value);
      setSelectedOperation(operation);
    },
    [setSelectedOperation, filteredOperations],
  );

  React.useEffect(() => {
    const filtereItems = getFilteredItems(operations, filter);
    setFilteredOperations(filtereItems);
    dispatchOperationsCount({
      type: ReducerActionEnum.UpdateVerboseOperationsCount,
      value: filtereItems?.length,
    });
  }, [filter, setFilteredOperations, operations, dispatchOperationsCount]);

  return (
    <div className={classes.operationsNameListWrapper}>
      <TabList
        className={classes.operationsList}
        vertical
        selectedValue={selectedOperation?.id}
        onTabSelect={onTabSelect}
        key="operationNameList"
      >
        {tabListItems}
      </TabList>
    </div>
  );
};

const useOperationListNames = (
  filteredOperations: IVerboseOperation[] | null | undefined,
  classes: Record<
    | "operationName"
    | "root"
    | "operations"
    | "operationsList"
    | "operationNameWrapper"
    | "operationsNameListWrapper"
    | "opCountTxt"
    | "copyAllOpBtn",
    string
  >,
) =>
  React.useMemo(() => {
    const tabItems = filteredOperations?.map((op) => {
      return (
        <Tab key={op.id} value={op.id}>
          <div className={classes.operationNameWrapper}>
            {(op.operationName?.length || 0) > 30 ? (
              <Tooltip content={op.operationName || ""} relationship="label">
                <Text className={classes.operationName} weight={"semibold"}>
                  {op.operationName}
                </Text>
              </Tooltip>
            ) : (
              <Text className={classes.operationName} weight={"semibold"}>
                {op.operationName}
              </Text>
            )}

            <Text>{`(${op.id}):${op.operationType}:${op.fetchPolicy}`}</Text>
          </div>
        </Tab>
      );
    });

    return tabItems || [];
  }, [filteredOperations]);

const getFilteredItems = (
  items: IVerboseOperation[] | null | undefined,
  filter: string,
) => {
  if (filter.length === 0) {
    return items;
  } else {
    const filteredItems = items?.filter((item) => {
      return (
        item.operationName?.toLowerCase().indexOf(filter.toLowerCase()) != -1
      );
    });
    return filteredItems;
  }
};
