import * as React from "react";
import {
  Accordion,
  AccordionHeader,
  AccordionItem,
  AccordionPanel,
  Tooltip,
  Text,
  Button,
  Body1Strong,
} from "@fluentui/react-components";
import {
  IVerboseOperation,
  IOperationResult,
  IVerboseOperationDuration,
} from "apollo-inspector";
import { useStyles, stylesKeys } from "./verbose-operation-view-styles";
import { OperationVariables, WatchQueryFetchPolicy } from "@apollo/client";
import {
  getOperationName,
  isNumber,
  sizeInBytes,
} from "../utils/apollo-operations-tracker-utils";
import { DocumentNode } from "graphql";
import { ResultsFrom } from "../../../types";
import {
  IOperationsAction as IOperationsReducerActions,
  OperationReducerActionEnum,
} from "../operations-tracker-container-helper";

const spaceForStringify = 2;

interface IVerboseOperationViewProps {
  operation: IVerboseOperation | undefined | null;
  dispatchOperationsState: React.Dispatch<IOperationsReducerActions>;
}

export const VerboseOperationView = (props: IVerboseOperationViewProps) => {
  const { operation, dispatchOperationsState } = props;
  if (!operation) {
    return <></>;
  }
  const classes = useStyles();

  const { operationType, operationName } = operation;

  const accordionItems = React.useMemo(
    () => getAccordionItems(operation, classes),
    [operation, classes],
  );

  const closePreview = React.useCallback(() => {
    dispatchOperationsState({
      type: OperationReducerActionEnum.UpdateSelectedOperation,
      value: undefined,
    });
  }, [dispatchOperationsState]);

  if (!operation) {
    return null;
  }

  return (
    <div className={classes.operationView} key="verboseOperationView">
      <div className={classes.subHeading} key="verboseHeader">
        <div
          style={{ display: "flex", alignItems: "center" }}
          key="operationType1"
        >
          <h3 key="operationType">{`${operationType} : `}&nbsp;</h3>
          <Body1Strong underline key="operationName1ç">
            {operationName}
          </Body1Strong>
        </div>
        <Button
          size="small"
          className={classes.closeButton}
          onClick={closePreview}
          appearance="primary"
          key="closeButton"
        >
          Close
        </Button>
      </div>
      <div
        className={classes.accordionWrapper}
        key="operationnViewAccordionnWrapper"
      >
        <div className={classes.accordioPreWrapper}>
          <Accordion
            className={classes.operationDetails}
            key={"operationnViewAccordionn"}
            multiple
            collapsible
          >
            {...accordionItems}
          </Accordion>
        </div>
      </div>
    </div>
  );
};

const getAccordionItems = (
  operation: IVerboseOperation,
  classes: Record<stylesKeys, string>,
) => {
  const {
    operationName,
    operationString,
    result,
    variables,
    isOptimistic,
    affectedQueries,
    duration,
    fetchPolicy,
    error,
    warning,
  } = operation;
  const items = [];

  items.push(getOperationNamePanel(operationName, operationString, classes));
  items.push(getVariablesPanel(variables, classes));
  fetchPolicy && items.push(getFetchPolicyPanel(fetchPolicy, classes));
  items.push(getDurationPanel(duration, classes));
  items.push(getResultPanel(isOptimistic, result, classes));
  error && items.push(getErrorPanel(error, classes));
  warning && items.push(getWarningPanel(warning, classes));
  items.push(
    getAffectedQueriesPanel(affectedQueries as DocumentNode[], classes),
  );

  return items;
};

const getOperationNamePanel = (
  operationName: string | undefined,
  operationString: string,
  classes: Record<stylesKeys, string>,
) => {
  return (
    <AccordionItem value="operationName" key="operationName">
      <AccordionHeader>
        <Text style={{ fontWeight: "bold" }}>{operationName}</Text>
      </AccordionHeader>
      <AccordionPanel>
        <div className={classes.operationNameAccPanel}>{operationString}</div>
      </AccordionPanel>
    </AccordionItem>
  );
};

const getVariablesPanel = (
  variables: OperationVariables | undefined,
  classes: Record<stylesKeys, string>,
) => (
  <AccordionItem value="variables" key="variables">
    <Tooltip content={"Variables for the operation"} relationship="label">
      <AccordionHeader>
        <Text style={{ fontWeight: "bold" }}>{"Variables"}</Text>
      </AccordionHeader>
    </Tooltip>
    <AccordionPanel>
      <div className={classes.operationVariablesAccPanel}>
        {JSON.stringify(variables, null, spaceForStringify)}
      </div>
    </AccordionPanel>
  </AccordionItem>
);

const getFetchPolicyPanel = (
  fetchPolicy: WatchQueryFetchPolicy | undefined,
  classes: Record<stylesKeys, string>,
) => (
  <AccordionItem value="fetchPolicy" key="fetchPolicy">
    <Tooltip content={"Fetch policy of the operation"} relationship="label">
      <AccordionHeader>
        <Text style={{ fontWeight: "bold" }}>{`Fetch Policy ${
          fetchPolicy ? `(${fetchPolicy})` : ``
        }`}</Text>
      </AccordionHeader>
    </Tooltip>
    <AccordionPanel>
      <div className={classes.fetchPolicyAccPanel}> {fetchPolicy}</div>
    </AccordionPanel>
  </AccordionItem>
);

const getAffectedQueriesPanel = (
  affectedQueries: DocumentNode[],
  classes: Record<stylesKeys, string>,
) => {
  const affectedQueriesItems = affectedQueries.map((item, index) => ({
    key: index,
    header: getOperationName(item),
  }));

  return (
    <AccordionItem value="affectedQueries" key="affectedQueries">
      <Tooltip
        content={
          "Watch queries which are going to re-render due to the result of current operation"
        }
        relationship="label"
      >
        <AccordionHeader>
          <Text
            style={{ fontWeight: "bold" }}
          >{`Affected watch queries (${affectedQueriesItems.length})`}</Text>
        </AccordionHeader>
      </Tooltip>
      <AccordionPanel>
        <div className={classes.affectedQueriesAccPanel}>
          {affectedQueriesItems.map((query) => (
            <div>{query.header}</div>
          ))}
        </div>
      </AccordionPanel>
    </AccordionItem>
  );
};

const getResultPanel = (
  isOptimistic: boolean | undefined,
  result: IOperationResult[],
  classes: Record<stylesKeys, string>,
) => {
  const items = result.map((res: IOperationResult) => {
    const resultFrom = getResultFromString(res.from);

    return (
      <AccordionItem value={resultFrom} key={resultFrom}>
        <AccordionHeader>
          <Text style={{ fontWeight: "bold" }}>{`${resultFrom} ${
            res.size ? `(${sizeInBytes(res.size)})` : ``
          }`}</Text>
        </AccordionHeader>
        <AccordionPanel>
          <div className={classes.resultPanel}>
            {`${JSON.stringify(res.result, null, spaceForStringify)}`}
          </div>
        </AccordionPanel>
      </AccordionItem>
    );
  });

  return (
    <AccordionItem value="result" key="result">
      <Tooltip
        content={
          "Data/result of the operation, whether its from cache or network"
        }
        relationship="label"
      >
        <AccordionHeader>
          <Text style={{ fontWeight: "bold" }}>{`Result ${
            isOptimistic ? "(Optimistic result)" : ""
          }`}</Text>
        </AccordionHeader>
      </Tooltip>
      <AccordionPanel>
        <Accordion collapsible>{...items}</Accordion>
      </AccordionPanel>
    </AccordionItem>
  );
};

const getResultFromString = (from: ResultsFrom) => {
  switch (from) {
    case ResultsFrom.CACHE: {
      return "CACHE";
    }
    case ResultsFrom.NETWORK: {
      return "NETWORK";
    }
  }
  return "Unknown";
};

const getErrorPanel = (error: unknown, classes: Record<stylesKeys, string>) => (
  <AccordionItem value="errorPanel" key="errorPanel">
    <Tooltip
      content={"Error message for operation failure"}
      relationship="label"
    >
      <AccordionHeader>
        <Text style={{ fontWeight: "bold" }}>{`Error ${
          error ? "(failed)" : ""
        }`}</Text>
      </AccordionHeader>
    </Tooltip>
    <AccordionPanel>
      <div className={classes.errorAccPanel}> {JSON.stringify(error)}</div>
    </AccordionPanel>
  </AccordionItem>
);

const getWarningPanel = (
  warning: unknown[],
  classes: Record<stylesKeys, string>,
) => (
  <AccordionItem value="warningPanel" key="warningPanel">
    <Tooltip
      content={
        "Show any warning like missing field error or why the result is not fetched from cache"
      }
      relationship="label"
    >
      <AccordionHeader>
        <Text style={{ fontWeight: "bold" }}>{`Warning`}</Text>
      </AccordionHeader>
    </Tooltip>
    <AccordionPanel>
      <div className={classes.warningAccPanel}> {JSON.stringify(warning)}</div>
    </AccordionPanel>
  </AccordionItem>
);

const getDurationPanel = (
  duration: IVerboseOperationDuration | undefined,
  classes: Record<stylesKeys, string>,
) => (
  <AccordionItem value="duration" key="duration">
    <Tooltip
      content={"Detailed time info for operation in milliSeconds"}
      relationship="label"
    >
      <AccordionHeader>
        <Text style={{ fontWeight: "bold" }}>{`Duration ${
          duration?.totalTime ? `(${duration.totalTime} ms)` : `(ms)`
        }`}</Text>
      </AccordionHeader>
    </Tooltip>
    <AccordionPanel>
      <div className={classes.durationAccPanel}>
        <Text key="1">{`Total execution time: ${duration?.totalTime}`}</Text>
        {isNumber(duration?.requestExecutionTime) ? (
          <Text key="2">{`Time spend to get the data from resolver: ${duration?.requestExecutionTime}`}</Text>
        ) : (
          <div />
        )}
        {isNumber(duration?.cacheWriteTime) ? (
          <Text key="3">{`Time spent to write data to cache: ${duration?.cacheWriteTime}`}</Text>
        ) : (
          <div />
        )}
        {isNumber(duration?.cacheDiffTime) ? (
          <Text key="4">{`Time spent to diff data from cache: ${duration?.cacheDiffTime}`}</Text>
        ) : (
          <div />
        )}
        {isNumber(duration?.cacheBroadcastWatchesTime) ? (
          <Text key="5">{`Time spent to broadcastWatches: ${duration?.cacheBroadcastWatchesTime}`}</Text>
        ) : (
          <div />
        )}
      </div>
    </AccordionPanel>
  </AccordionItem>
);
