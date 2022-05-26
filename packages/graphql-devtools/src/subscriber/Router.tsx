import React, { useContext } from "react";
import { MemoryRouter, Switch, Route } from "react-router-dom";
import { ApolloCache } from "./apollo-cache";
import { WatchedQueries, Mutations } from "./apollo-tracker";
import { ApolloTrackerMetadataContext } from "./contexts/apollo-tracker-metadata-context";
import { AdditionalInformations } from "./apollo-additional-informations";
import { GraphiQLRenderer } from "./graphiql";
import {
  ApolloCacheContext,
  ApolloCacheContextType,
} from "./contexts/apollo-cache-context";
import { Menu } from "../components";
import RecentActivityContainer from "./apollo-recent-activity/recent-activity-container";
import { ApolloGlobalOperationsContext } from "./contexts/apollo-global-operations-context";
import { ApolloGlobalOperations } from "../types";

function getCacheDataCount(cacheContextData: ApolloCacheContextType) {
  if (!cacheContextData?.cacheObjects) return 0;

  return Object.keys(cacheContextData.cacheObjects.cache).length;
}

function hideGlobalOperations(globalOperations: ApolloGlobalOperations) {
  return (
    !globalOperations.globalMutations.length &&
    !globalOperations.globalQueries.length &&
    !globalOperations.globalSubscriptions.length
  );
}

const Router = React.memo(() => {
  const { mutationsCount, queriesCount, mutationsHaveError, queriesHaveError } =
    useContext(ApolloTrackerMetadataContext);
  const cacheData = useContext(ApolloCacheContext);
  const globalOperations = useContext(ApolloGlobalOperationsContext);

  return (
    <MemoryRouter>
      <div style={{ display: "flex", height: "calc(100% - 40px)" }}>
        <Menu
          cacheCount={getCacheDataCount(cacheData)}
          mutationsCount={mutationsCount}
          queriesCount={queriesCount}
          mutationsHaveError={mutationsHaveError}
          queriesHaveError={queriesHaveError}
          hideGlobalOperations={hideGlobalOperations(globalOperations)}
        />
        <Switch>
          <Route path="/apollo-additional-informations">
            <AdditionalInformations />
          </Route>
          <Route path="/apollo-queries">
            <WatchedQueries />
          </Route>
          <Route path="/apollo-mutations">
            <Mutations />
          </Route>
          <Route path="/activity">
            <RecentActivityContainer />
          </Route>
          <Route path="/graphiql">
            <GraphiQLRenderer />
          </Route>
          <Route path="/">
            <ApolloCache />
          </Route>
        </Switch>
      </div>
    </MemoryRouter>
  );
});

export default Router;
