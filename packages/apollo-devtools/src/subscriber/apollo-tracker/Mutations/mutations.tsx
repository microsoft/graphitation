import React, { useMemo, useState, useContext } from "react";
import { List, VerticalViewer } from "../../../components";
import { ApolloGlobalOperationsContext } from "../../contexts/apollo-global-operations-context";
import { mutationsStyles } from "./mutations.styles";
import { mergeClasses, Text } from "@fluentui/react-components";
import { Mutation } from "../../../types";

export const Mutations = ({ mutations }: { mutations: Mutation[] }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [selected, setSelected] = useState<number>(0);
  const globalOperations = useContext(ApolloGlobalOperationsContext);
  const classes = mutationsStyles();
  const globalMutations = useMemo(
    () => new Set(globalOperations.globalMutations),
    [globalOperations],
  );

  if (!mutations.length) {
    return null;
  }

  const selectedMutation = mutations[selected];

  return (
    <div className={classes.root}>
      <div
        className={mergeClasses(
          classes.innerContainer,
          isExpanded && classes.innerContainerFull,
        )}
      >
        <List
          isExpanded={isExpanded}
          items={mutations
            .map(({ name, id, errorMessage }: Mutation, key) => ({
              index: id,
              key: `${name}-${id}`,
              onClick: () => setSelected(key),
              content: (
                <>
                  <Text weight={key === selected ? "semibold" : "regular"}>
                    {name}
                  </Text>
                  {globalMutations.has(name) && (
                    <Text weight="semibold">{" (GO)"}</Text>
                  )}
                  {errorMessage && (
                    <Text
                      weight="semibold"
                      className={errorMessage ? classes.error : ""}
                    >
                      {" (ERROR)"}
                    </Text>
                  )}
                </>
              ),
              truncate: true,
            }))
            .reverse()}
          selectedIndex={selected}
        />
        <div className={classes.viewerContainer}>
          <VerticalViewer
            data={selectedMutation}
            isExpanded={isExpanded}
            onExpand={() => setIsExpanded(!isExpanded)}
            isMutation
          />
        </div>
      </div>
    </div>
  );
};
