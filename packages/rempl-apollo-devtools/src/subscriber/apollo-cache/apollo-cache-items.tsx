import React from "react";
import { CacheObjectWithSize } from "./types";
import { useStyles } from "./apollo-cache-items.styles";
import { Button, mergeClasses, Text } from "@fluentui/react-components";
import { Open20Filled, Delete20Regular } from "@fluentui/react-icons";
import { Dialog } from "./../../components";

interface IApolloCacheItems {
  cacheObjectsWithSize: CacheObjectWithSize[];
  removeCacheItem: (key: string) => void;
}

export const ApolloCacheItems = React.memo(
  ({ cacheObjectsWithSize, removeCacheItem }: IApolloCacheItems) => {
    const [detailsValue, setDetailsValue] = React.useState<
      CacheObjectWithSize | undefined
    >(undefined);
    const classes = useStyles();

    if (!cacheObjectsWithSize.length) {
      return null;
    }

    const closeDetails = () => {
      setDetailsValue(undefined);
    };

    const buildApolloCacheItems =
      (
        removeCacheItem: (key: string) => void,
        setDetailsValue: (value: CacheObjectWithSize) => void,
      ) =>
      (item: CacheObjectWithSize, index: number) =>
        (
          <div className={classes.itemContainer} key={`${item.key}-${index}`}>
            <div className={classes.keyColumn}>{item.key}</div>
            <div>{item.valueSize} B</div>
            <div>
              <Button
                title="Show details"
                className={mergeClasses(
                  classes.actionButton,
                  classes.detailsButton,
                )}
                onClick={() => {
                  setDetailsValue(item);
                }}
              >
                <Open20Filled />
              </Button>
              <Button
                title="Remove item"
                className={mergeClasses(
                  classes.actionButton,
                  classes.removeButton,
                )}
                onClick={(e) => {
                  removeCacheItem(item.key);
                  e.stopPropagation();
                }}
              >
                <Delete20Regular />
              </Button>
            </div>
          </div>
        );

    return (
      <div className={classes.root}>
        <div className={classes.itemContainer}>
          <Text size={200} weight="semibold">
            Key
          </Text>
          <Text size={200} weight="semibold">
            Value size
          </Text>
        </div>
        {cacheObjectsWithSize.map(
          buildApolloCacheItems(removeCacheItem, setDetailsValue),
        )}
        {detailsValue ? (
          <Dialog value={detailsValue} onClose={closeDetails} />
        ) : null}
      </div>
    );
  },
);
