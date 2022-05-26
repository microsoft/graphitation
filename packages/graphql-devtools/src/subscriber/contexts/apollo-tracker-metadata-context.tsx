import React, { useState, useEffect } from "react";
import { ApolloTrackerMetadata } from "../../types";
import { remplSubscriber } from "../rempl";

export const defaultMetadata = {
  mutationsCount: 0,
  queriesCount: 0,
  queriesHaveError: false,
  mutationsHaveError: false,
};

export const ApolloTrackerMetadataContext =
  React.createContext<ApolloTrackerMetadata>(defaultMetadata);

export const ApolloClientMetadataWrapper = ({
  children,
}: {
  children: JSX.Element;
}) => {
  const [apolloTrackerMetadata, setApolloTrackerMetadata] =
    useState<ApolloTrackerMetadata>(defaultMetadata);

  useEffect(() => {
    const unsubscribeMetadata = remplSubscriber
      .ns("apollo-tracker-metadata")
      .subscribe((data: Partial<ApolloTrackerMetadata>) => {
        if (data != null) {
          const {
            mutationsCount,
            queriesCount,
            queriesHaveError,
            mutationsHaveError,
          } = data;

          if (!window.REMPL_APOLLO_TRACKER_METADATA) {
            window.REMPL_APOLLO_TRACKER_METADATA = defaultMetadata;
          }

          const {
            mutationsCount: oldMutationsCount,
            queriesCount: oldQueriesCount,
            queriesHaveError: oldQueriesHaveError,
            mutationsHaveError: oldMutationsHaveError,
          } = window.REMPL_APOLLO_TRACKER_METADATA;

          if (
            oldMutationsCount !== mutationsCount ||
            oldQueriesCount !== queriesCount ||
            oldQueriesHaveError !== queriesHaveError ||
            oldMutationsHaveError !== mutationsHaveError
          ) {
            const newData: ApolloTrackerMetadata = {
              mutationsCount: mutationsCount ?? oldMutationsCount,
              queriesCount: queriesCount ?? oldQueriesCount,
              queriesHaveError: queriesHaveError ?? oldQueriesHaveError,
              mutationsHaveError: mutationsHaveError ?? oldMutationsHaveError,
            };

            window.REMPL_APOLLO_TRACKER_METADATA = newData;

            setApolloTrackerMetadata(newData);
          }
        }
      });

    return () => {
      unsubscribeMetadata();
    };
  }, []);

  console.log(apolloTrackerMetadata);
  return (
    <ApolloTrackerMetadataContext.Provider value={apolloTrackerMetadata}>
      {children}
    </ApolloTrackerMetadataContext.Provider>
  );
};
