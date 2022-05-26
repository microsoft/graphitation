import React from "react";
import {Button, Text } from "@fluentui/react-components";
import { useStyles } from "./vertical-viewer.styles";
import {ChevronCircleLeft20Regular, ChevronCircleRight20Regular} from "@fluentui/react-icons";

interface IDataItem {
  name: string;
  variables: Record<string, unknown>;
  queryString?: string;
  mutationString?: string;
  errorMessage?: string;
  cachedData?: Record<string, unknown>;
}

interface VerticalViewerProps {
  data: IDataItem;
  isExpanded: boolean;
  onExpand: any;
  isMutation?: boolean;
}

export const VerticalViewer = React.memo(
  ({ data, isExpanded, onExpand, isMutation }: VerticalViewerProps) => {
    const classes = useStyles();

    return (
      <div
        className={classes.container}
      >
        <div className={classes.header}>
            <Button
              title={isExpanded ? "Show list" : "Expand"}
              className={classes.controlButton}
              onClick={onExpand}
            >
              {isExpanded ? <ChevronCircleRight20Regular /> : <ChevronCircleLeft20Regular />}
            </Button>
          <Text className={classes.title} weight="semibold">
            {`${data.name} (${isMutation ? "Mutation" : "Watched Query"})`}
          </Text>
        </div>
        <div className={classes.details}>
          <div>
            <Text weight="semibold">{isMutation ? "Mutation String" : "Query String"}</Text>
            <div className={classes.codeBox} style={{ fontSize: "12px" }}>
              <pre>
                <code>
                  <p>{isMutation ? data.mutationString : data.queryString}</p>
                </code>
              </pre>
            </div>
          </div>
          <div>
            <Text weight="semibold">Variables</Text>
            <div className={classes.codeBox}>
              <pre>
                <code>
                  <p>{JSON.stringify(data.variables, null, 2)}</p>
                </code>
              </pre>
            </div>
          </div>
          {data.errorMessage && (
            <div>
              <Text weight="semibold">Error</Text>
              <div className={classes.codeBox}>
                <pre>
                  <code>
                    <p>{data.errorMessage}</p>
                  </code>
                </pre>
              </div>
            </div>
          )}
          {!isMutation && (
            <div>
              <Text weight="semibold">Cache Data</Text>
              <div className={classes.codeBox}>
                <pre>
                  <code>
                    <p>{JSON.stringify(data.cachedData, null, 2)}</p>
                  </code>
                </pre>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }
);
