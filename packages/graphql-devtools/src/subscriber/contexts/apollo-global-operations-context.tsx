import React, { useState, useEffect } from "react";
import { ApolloGlobalOperations } from "../../types";
import { remplSubscriber } from "../rempl";

export const ApolloGlobalOperationsContext =
  React.createContext<ApolloGlobalOperations>({
    globalQueries: [],
    globalMutations: [],
    globalSubscriptions: [],
  });

export const ApolloGlobalOperationsWrapper = ({
  children,
}: {
  children: JSX.Element;
}) => {
  const [apolloGlobalOperations, setApolloGlobalOperations] =
    useState<ApolloGlobalOperations>({
      globalQueries: [],
      globalMutations: [],
      globalSubscriptions: [],
    });

  useEffect(
    () =>
      remplSubscriber
        .ns("apollo-global-operations")
        .subscribe((data: ApolloGlobalOperations) => {
          if (data) {
            setApolloGlobalOperations(data);
          }
        }),
    []
  );

  return (
    <ApolloGlobalOperationsContext.Provider value={apolloGlobalOperations}>
      {children}
    </ApolloGlobalOperationsContext.Provider>
  );
};
