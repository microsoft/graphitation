import React from "react";
import { ActivityDialog, List, Dialog } from "../../components";
import { mergeClasses, Text } from "@fluentui/react-components";
import { useStyles } from "./recent-activity.styles";
import { RECENT_DATA_CHANGES_TYPES, ACTIVITY_TYPE } from "../../consts";
import { RecentActivities } from "../../types";
import sizeOf from "object-sizeof";

function getDateValue(value: number): string {
  if (value < 10) {
    return `0${value}`;
  }

  return value.toString();
}

function getTime(timestamp: number) {
  const date = new Date(timestamp);
  return `${getDateValue(date.getHours())}:${getDateValue(
    date.getMinutes(),
  )}:${getDateValue(date.getSeconds())}.${date.getMilliseconds()}`;
}
export const RecentActivity = ({
  activity,
}: {
  activity: RecentActivities[];
}) => {
  const classes = useStyles();
  const [detailsValue, setDetailsValue] = React.useState<any>(null);

  const closeDetails = () => {
    setDetailsValue(null);
  };

  const buildItem = (elem: any, timestamp: number, type: string) => (
    <div className={classes.activityItem} key={timestamp}>
      <Text className={classes.name} block>
        <Text weight="semibold">{type}: </Text>
        {elem.type === ACTIVITY_TYPE.OPERATION
          ? elem.data?.name
          : elem.data.__activity_key}
      </Text>
      <div
        className={mergeClasses(
          classes.label,
          elem.change === RECENT_DATA_CHANGES_TYPES.ADDED && classes.added,
          elem.change === RECENT_DATA_CHANGES_TYPES.REMOVED && classes.removed,
          elem.change === RECENT_DATA_CHANGES_TYPES.CHANGED && classes.changed,
        )}
      >
        {elem.change}
      </div>
      <div className={classes.time}>{getTime(timestamp)}</div>
    </div>
  );

  const buildActivityItems = () => {
    let items: any[] = [];
    activity.forEach((elem: any, index: number) => {
      const m = elem.mutations.map((mutation: any) => ({
        index: index + elem.timestamp,
        onClick: () => {
          setDetailsValue({
            ...mutation,
            __activity_type: mutation.type,
            isMutation: true,
          });
        },
        content: buildItem(mutation, elem.timestamp, "Mutation"),
      }));
      const q = elem.queries.map((query: any) => ({
        index: index + elem.timestamp,
        onClick: () => {
          setDetailsValue({
            ...query,
            __activity_type: query.type,
            isMutation: false,
          });
        },
        content: buildItem(query, elem.timestamp, "Query"),
      }));
      const c = elem.cache.map((cache: any) => ({
        index: index + elem.timestamp,
        onClick: () => {
          setDetailsValue({ ...cache, __activity_type: cache.type });
        },
        content: buildItem(cache, elem.timestamp, "Cache item"),
      }));

      items = [...items, ...c, ...q, ...m];
    });

    return items;
  };

  return (
    <div className={classes.activityContainer}>
      <List items={buildActivityItems()} search={false} fill />
      <DetailComponent
        detailsValue={detailsValue}
        closeDetails={closeDetails}
      />
    </div>
  );
};

const DetailComponent = ({
  detailsValue,
  closeDetails,
}: {
  detailsValue: any;
  closeDetails: () => void;
}) => {
  if (!detailsValue) return null;

  return detailsValue.__activity_type === ACTIVITY_TYPE.OPERATION ? (
    <ActivityDialog value={detailsValue} onClose={closeDetails} />
  ) : (
    <Dialog
      value={{
        key: detailsValue.__activity_key,
        valueSize: sizeOf(detailsValue),
        value: detailsValue,
      }}
      onClose={closeDetails}
    />
  );
};
