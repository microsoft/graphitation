import React, { useContext } from "react";
import { MemoryRouter, Switch, Route } from "react-router-dom";
import { ApolloCache } from "./apollo-cache";
import { WatchedQueries, Mutations } from "./apollo-tracker";
import { ApolloTrackerDataCountContext } from "./contexts/apollo-tracker-data-count-context";
import { AdditionalInformations } from "./apollo-additional-informations";
import { GraphiQLRenderer } from "./graphiql";
import {
  ApolloCacheContext,
  ApolloCacheContextType,
} from "./contexts/apollo-cache-context";
import { Menu } from "../components";
import RecentActivityContainer from "./apollo-recent-activity/recent-activity-container";

const getCacheDataCount = (cacheContextData: ApolloCacheContextType) => {
  if (!cacheContextData?.cacheObjects) return 0;

  return Object.keys(cacheContextData.cacheObjects.cache).length;
};

const Router = React.memo(() => {
  const { mutationsCount, queriesCount } = useContext(
    ApolloTrackerDataCountContext,
  );
  const cacheData = useContext(ApolloCacheContext);

  return (
    <MemoryRouter>
      <div style={{ display: "flex", height: "calc(100% - 40px)" }}>
        <Menu
          cacheCount={getCacheDataCount(cacheData)}
          mutationsCount={mutationsCount}
          queriesCount={queriesCount}
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
