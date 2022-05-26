import React, { useState, useContext, useMemo } from "react";
import { ApolloGlobalOperationsContext } from "../../contexts/apollo-global-operations-context";
import { List, VerticalViewer } from "../../../components";
import { watchedQueriesStyles } from "./watched-queries.styles";
import { mergeClasses, Text } from "@fluentui/react-components";
import { WatchedQuery } from "../../../types";

export const WatchedQueries = ({ queries }: { queries: WatchedQuery[] }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [selected, setSelected] = useState<number>(0);
  const globalOperations = useContext(ApolloGlobalOperationsContext);
  const globalQueries = useMemo(
    () => new Set(globalOperations.globalQueries),
    [globalOperations]
  );
  const classes = watchedQueriesStyles();

  if (!queries.length) {
    return null;
  }

  const selectedQuery = queries[selected];

  return (
    <div className={classes.root}>
      <div className={mergeClasses(
        classes.innerContainer, 
        isExpanded && classes.innerContainerFull
      )}>
        <List
          isExpanded={isExpanded}
          items={queries
            .map(({ name, id, errorMessage }: WatchedQuery, key) => ({
              index: id,
              key: `${name}-${id}`,
              onClick: () => setSelected(key),
              content: (
                <>
                  <Text weight={key === selected ? "semibold" : "regular"}>
                    {name}
                  </Text>
                  {globalQueries.has(name) && (
                    <Text weight="semibold">{" (GO)"}</Text>
                  )}
                  {errorMessage && (
                    <Text
                      className={errorMessage ? classes.error : ""}
                      weight={"semibold"}
                    >
                      {" (ERROR)"}
                    </Text>
                  )}
                </>
              ),
            }))
            .reverse()}
          selectedIndex={selected}
        />
        <div className={classes.viewerContainer}>
          <VerticalViewer
            data={selectedQuery}
            isExpanded={isExpanded}
            onExpand={() => setIsExpanded(!isExpanded)}
          />
        </div>
      </div>
    </div>
  );
};
