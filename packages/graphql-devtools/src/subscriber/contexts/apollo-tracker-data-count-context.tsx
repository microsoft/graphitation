import React, { useState, useEffect } from "react";
import { ApolloTrackerDataCount } from "../../types";
import { remplSubscriber } from "../rempl";

export const ApolloTrackerDataCountContext = React.createContext<ApolloTrackerDataCount>(
  {
    mutationsCount: 0,
    queriesCount: 0,
  },
);

export const ApolloClientDataCountWrapper = ({
  children,
}: {
  children: JSX.Element;
}) => {
  const [
    apolloTrackerQueriesCount,
    setApolloTrackerQueriesCount,
  ] = useState<number>(0);

  const [
    apolloTrackerMutationsCount,
    setApolloTrackerMutationsCount,
  ] = useState<number>(0);

  useEffect(() => {
    const unsubscribeQueryCount = remplSubscriber
      .ns("apollo-tracker-queries-count")
      .subscribe((data: number) => {
        if (data != null) {
          setApolloTrackerQueriesCount(data);
        }
      });

    const unsubscribeMutationCount = remplSubscriber
      .ns("apollo-tracker-mutations-count")
      .subscribe((data: number) => {
        if (data != null) {
          setApolloTrackerMutationsCount(data);
        }
      });

    return () => {
      unsubscribeQueryCount();
      unsubscribeMutationCount();
    };
  }, []);

  return (
    <ApolloTrackerDataCountContext.Provider
      value={{
        mutationsCount: apolloTrackerMutationsCount,
        queriesCount: apolloTrackerQueriesCount,
      }}
    >
      {children}
    </ApolloTrackerDataCountContext.Provider>
  );
};
