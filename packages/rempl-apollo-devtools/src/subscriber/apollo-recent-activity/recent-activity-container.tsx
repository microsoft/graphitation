import React, { useState, useEffect } from "react";
import { RecentActivities } from "../../types";
import { Button, mergeClasses } from "@fluentui/react-components";
import { remplSubscriber } from "../rempl";
import { useStyles } from "./recent-activity.styles";
import { RecentActivity } from "./recent-activity";
import { Search } from "../../components";
import { Info20Regular } from "@fluentui/react-icons";
import { Checkbox } from "@fluentui/react-checkbox";

function filterActivities(
  recentActivities: RecentActivities[],
  searchKey: string,
  showCache: boolean,
  showOperations: boolean,
): RecentActivities[] {
  const filtredActivities = recentActivities.map(
    ({ queries, mutations, cache, timestamp }) => {
      return {
        timestamp,
        cache: showCache ? cache : [],
        queries: showOperations ? queries : [],
        mutations: showOperations ? mutations : [],
      };
    },
  );

  if (!searchKey?.trim()) return filtredActivities;

  return filtredActivities.map(({ queries, mutations, cache, timestamp }) => {
    const filteredQueries = queries.filter(({ data: { name } }) =>
      name.toLowerCase().includes(searchKey.toLowerCase()),
    );

    const filteredMutations = mutations.filter(({ data: { name } }) =>
      name.toLowerCase().includes(searchKey.toLowerCase()),
    );

    const filteredCache = cache.filter(({ data: { __activity_key } }) =>
      __activity_key.toLowerCase().includes(searchKey.toLowerCase()),
    );

    return {
      timestamp,
      cache: filteredCache,
      queries: filteredQueries,
      mutations: filteredMutations,
    };
  });
}

export const RecentActivityContainer = React.memo(() => {
  const [recentActivities, setRecentActivities] = useState<RecentActivities[]>(
    [],
  );

  const [recordRecentActivity, setRecordRecentActivity] =
    useState<boolean>(false);

  const [openDescription, setOpenDescription] = useState<boolean>(false);
  const [searchKey, setSearchKey] = React.useState("");
  const [showCache, setShowCache] = React.useState(true);
  const [showOperations, setShowOperations] = React.useState(true);
  const classes = useStyles();

  useEffect(() => {
    const unsubscribe = remplSubscriber
      .ns("apollo-recent-activity")
      .subscribe((data) => {
        if (data) {
          const storedRecentActivities =
            window.REMPL_GRAPHQL_DEVTOOLS_RECENT_ACTIVITIES || [];
          const newRecentActivities = [data, ...storedRecentActivities];
          window.REMPL_GRAPHQL_DEVTOOLS_RECENT_ACTIVITIES = newRecentActivities;
          setRecentActivities(newRecentActivities);
        }
      });

    return () => {
      remplSubscriber.callRemote("recordRecentActivity", {
        shouldRecord: false,
      });
      unsubscribe();
    };
  }, []);

  const recordRecentActivityRempl = React.useCallback(
    (shouldRecord: boolean) => {
      remplSubscriber.callRemote("recordRecentActivity", { shouldRecord });
    },
    [],
  );

  const toggleRecordRecentChanges = () => {
    recordRecentActivityRempl(!recordRecentActivity);
    setRecordRecentActivity(!recordRecentActivity);
  };

  return (
    <div className={classes.root}>
      <div
        className={mergeClasses(
          classes.innerContainer,
          openDescription && classes.innerContainerDescription,
        )}
      >
        <div className={classes.header}>
          <div>
            <Button
              title="Information"
              tabIndex={0}
              className={classes.infoButton}
              onClick={() => setOpenDescription(!openDescription)}
            >
              <Info20Regular />
            </Button>
            <Button onClick={toggleRecordRecentChanges}>
              {recordRecentActivity
                ? "Stop recording"
                : "Record recent activity"}
            </Button>
            <Checkbox
              onChange={() => setShowCache((checked) => !checked)}
              checked={showCache}
              label="Cache"
            />
            <Checkbox
              onChange={() => setShowOperations((checked) => !checked)}
              checked={showOperations}
              label="Operations"
            />
          </div>
          <div className={classes.searchContainer}>
            <Search
              onSearchChange={(e: React.SyntheticEvent) => {
                const input = e.target as HTMLInputElement;
                setSearchKey(input.value);
              }}
            />
          </div>
        </div>
        <div
          className={mergeClasses(
            classes.description,
            openDescription && classes.openDescription,
          )}
        >
          [EXPERIMENTAL FEATURE - Results may not be 100% accurate] It monitors
          changes in cache, fired mutations and activated/deactivated queries.
        </div>
        <RecentActivity
          activity={filterActivities(
            recentActivities,
            searchKey,
            showCache,
            showOperations,
          )}
        />
      </div>
    </div>
  );
});

export default RecentActivityContainer;
