import React from "react";
import { ActivityDialog, List } from "../../components";
import { mergeClasses, Text } from "@fluentui/react-components";
import { useStyles } from "./recent-activity.styles";
import moment from "moment";

export const RecentActivity = ({ activity }: {activity: any[]}) => {
  const classes = useStyles();
  const [detailsValue, setDetailsValue] = React.useState<any>(undefined);

  const closeDetails = () => {
    setDetailsValue(undefined);
  };

  const buildItem = (elem: any, timestamp: number, type: string) => (
    <div
      className={classes.activityItem} 
      key={timestamp}>
      <Text className={classes.name} block>
        <Text weight="semibold">{type}: </Text>
        {elem.data?.name}
      </Text>
      <div className={mergeClasses(
        classes.label,
        elem.change === 'added' && classes.added,
        elem.change === 'removed' && classes.removed
      )}>{elem.change}</div>
      <div className={classes.time}>{moment(timestamp).format('hh:mm:ss')}</div>
    </div>
  );

  const buildActivityItems = () => {
    let items: any[] = [];

    activity.forEach((elem: any, index: number) => {
      const m = elem.mutations.map((mutation: any) => ({
        index: index + elem.timestamp,
        onClick: () => {setDetailsValue({...mutation, isMutation: true})},
        content: (buildItem(mutation, elem.timestamp, 'Mutation'))
      }));
      const q = elem.queries.map((query: any) => ({
        index: index + elem.timestamp,
        onClick: () => {setDetailsValue({...query, isMutation: false})},
        content: (buildItem(query, elem.timestamp, "Query"))
      }));
      items = [...items, ...m, ...q];
    });

    return items;
  };

  return (
    <div className={classes.activityContainer}>
      <List 
        items={buildActivityItems()}
        search={false}
        fill
      />
      {detailsValue ? <ActivityDialog value={detailsValue} onClose={closeDetails}/> : null}
    </div>
  )
};