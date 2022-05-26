import React, { useState, useEffect } from "react";
import { RecentActivities } from "../../types";
import { Button } from "@fluentui/react-components";
import { remplSubscriber } from "../rempl";
import { useStyles } from "./recent-activity.styles";
import { RecentActivity } from "./recent-activity";

export const RecentActivityContainer = React.memo(() => {
  const [recentActivities, setRecentActivities] = useState<RecentActivities[]>(
    [],
  );
  const [recordRecentActivity, setRecordRecentActivity] = useState<boolean>(
    false,
  );
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
    [],
  );

  const toggleRecordRecentChanges = () => {
    recordRecentActivityRempl(!recordRecentActivity);
    setRecordRecentActivity(!recordRecentActivity);
    console.log("recentActivities", recentActivities);
  };

  return (
    <div className={classes.root}>
      <div className={classes.innerContainer}>
        <div className={classes.header}>
          <Button onClick={toggleRecordRecentChanges}>
            {recordRecentActivity
              ? "Stop recording"
              : "Recording recent activity"}
          </Button>
        </div>
        <RecentActivity activity={recentActivities} />
      </div>
    </div>
  );
});

export default RecentActivityContainer;
