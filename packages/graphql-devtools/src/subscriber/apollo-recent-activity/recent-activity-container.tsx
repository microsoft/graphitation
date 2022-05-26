import React, { useState, useEffect } from "react";
import { RecentActivities } from "../../types";
import { Button, mergeClasses } from "@fluentui/react-components";
import { remplSubscriber } from "../rempl";
import { useStyles } from "./recent-activity.styles";
import { RecentActivity } from "./recent-activity";
import { Search } from "../../components";
import { Info20Regular } from "@fluentui/react-icons";

function filterActivities(
  recentActivities: RecentActivities[],
  searchKey: string
): RecentActivities[] {
  if (!searchKey?.trim()) return recentActivities;

  return recentActivities.map(({ queries, mutations, timestamp }) => {
    const filteredQueries = queries.filter(({ data: { name } }) =>
      name.toLowerCase().includes(searchKey.toLowerCase())
    );

    const filteredMutations = mutations.filter(({ data: { name } }) =>
      name.toLowerCase().includes(searchKey.toLowerCase())
    );

    return {
      timestamp,
      queries: filteredQueries,
      mutations: filteredMutations,
    };
  });
}

export const RecentActivityContainer = React.memo(() => {
  const [recentActivities, setRecentActivities] = useState<RecentActivities[]>(
    []
  );
  const [recordRecentActivity, setRecordRecentActivity] =
    useState<boolean>(false);

  const [openDescription, setOpenDescription] = useState<boolean>(false);
  const [searchKey, setSearchKey] = React.useState("");
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
        shouldRecord: true,
      });
      unsubscribe();
    };
  }, []);

  const recordRecentActivityRempl = React.useCallback(
    (shouldRecord: boolean) => {
      remplSubscriber.callRemote("recordRecentActivity", { shouldRecord });
    },
    []
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
          openDescription && classes.innerContainerDescription
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
                : "Recording recent activity"}
            </Button>
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
            openDescription && classes.openDescription
          )}
        >
          Monitor recently fired mutations and recently activated/deactivated
          queries.
        </div>
        <RecentActivity
          activity={filterActivities(recentActivities, searchKey)}
        />
      </div>
    </div>
  );
});

export default RecentActivityContainer;
