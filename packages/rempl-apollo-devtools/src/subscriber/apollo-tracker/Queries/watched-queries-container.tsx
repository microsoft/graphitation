import React, { useState, useEffect, memo } from "react";
import { WatchedQuery } from "../../../types";
import { remplSubscriber } from "../../rempl";
import { WatchedQueries } from "./watched-queries";

const WatchedQueriesContainer = memo(() => {
  const [apolloTrackerQueries, setApolloTrackerQueries] = useState<
    WatchedQuery[]
  >([]);
  useEffect(() => {
    const unsubscribe = remplSubscriber
      .ns("apollo-tracker-queries")
      .subscribe((data: WatchedQuery[]) => {
        if (data) {
          setApolloTrackerQueries(data);
        }
      });

    return () => {
      unsubscribe();
    };
  }, []);

  return <WatchedQueries queries={apolloTrackerQueries} />;
});

export default WatchedQueriesContainer;
