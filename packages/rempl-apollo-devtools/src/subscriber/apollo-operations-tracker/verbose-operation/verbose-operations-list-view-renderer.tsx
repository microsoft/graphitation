import * as React from "react";
import { TabList, Tab, Text, Tooltip } from "@fluentui/react-components";
import { IVerboseOperation } from "apollo-inspector";
import { Search } from "../search/search";
import { useStyles } from "./verbose-operations-list-view-renderer-styles";
import { VerboseOperationView } from "./verbose-operation-view";

export interface IVerboseOperationViewRendererProps {
  operations: IVerboseOperation[] | null;
}

export const VerboseOperationsListViewRenderer = (
  props: IVerboseOperationViewRendererProps,
) => {
  const { operations } = props;
  const [selectedOperation, setSelectedOperation] = React.useState(
    props.operations?.[0],
  );
  const [filteredOperations, setFilteredOperations] = React.useState(
    operations,
  );

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

  const filterItems = React.useCallback(
    (items: IVerboseOperation[] | null | undefined) => {
      setFilteredOperations(items as IVerboseOperation[] | null);
    },
    [setFilteredOperations],
  );

  return (
    <div className={classes.root}>
      <Text
        weight="medium"
        className={classes.opCountTxt}
      >{`Total operations count: ${operations?.length}`}</Text>
      <Search items={operations} setFilteredItems={filterItems} />
      <div className={classes.operations}>
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
        <VerboseOperationView operation={selectedOperation} />
      </div>
    </div>
  );
};

const useOperationListNames = (
  filteredOperations: IVerboseOperation[] | null,
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
