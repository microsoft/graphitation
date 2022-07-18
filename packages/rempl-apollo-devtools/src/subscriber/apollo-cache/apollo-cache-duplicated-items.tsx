import React from "react";
import { useStyles } from "./apollo-cache-duplicated-items.styles";
import {
  Accordion,
  AccordionItem,
  AccordionHeader,
  AccordionPanel,
  Text,
  Button,
} from "@fluentui/react-components";
import { Open20Filled } from "@fluentui/react-icons";
import { CacheDuplicates } from "../../types";
import { Dialog } from "../../components";
import { CacheObjectWithSize } from "./types";

interface IApolloCacheItems {
  duplicatedCacheObjects: CacheDuplicates;
  showDescription: boolean;
}

export const ApolloCacheDuplicatedItems = React.memo(
  ({ duplicatedCacheObjects, showDescription }: IApolloCacheItems) => {
    const classes = useStyles();

    const [detailsValue, setDetailsValue] = React.useState<
      CacheObjectWithSize | undefined
    >(undefined);

    const closeDetails = () => {
      setDetailsValue(undefined);
    };

    if (!duplicatedCacheObjects || !duplicatedCacheObjects.length) {
      return null;
    }

    return (
      <div className={classes.root}>
        {showDescription && (
          <div className={classes.description}>
            {
              "Checks whether some cache items have the same values except ID field(s). Checks only cache items of the same type."
            }
          </div>
        )}
        <Accordion multiple collapsible>
          {duplicatedCacheObjects.map((item, index) => (
            <AccordionItem value={index} key={`duplicates ${index}`}>
              <AccordionHeader className={classes.accordionHeader}>
                <Text weight="semibold">
                  {item.type}{" "}
                  <Text className={classes.counter}>
                    ({Object.keys(item.duplicates).length})
                  </Text>
                </Text>
              </AccordionHeader>
              <AccordionPanel>
                {Object.entries(item.duplicates).map(([key, value], index) => (
                  <div className={classes.cacheItem} key={`message ${index}`}>
                    <div className={classes.message}>{key}</div>
                    <div className={classes.message}>
                      {JSON.stringify(value)}
                    </div>
                    <Button
                      title="Show details"
                      className={classes.detailsButton}
                      onClick={() => {
                        setDetailsValue({ key, value, valueSize: null });
                      }}
                    >
                      <Open20Filled />
                    </Button>
                  </div>
                ))}
              </AccordionPanel>
            </AccordionItem>
          ))}
        </Accordion>
        {detailsValue ? (
          <Dialog value={detailsValue} onClose={closeDetails} />
        ) : null}
      </div>
    );
  },
);
