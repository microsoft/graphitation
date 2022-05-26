import React from "react";
import { useStyles } from "./apollo-cache-duplicated-items.styles";
import {
  Accordion,
  AccordionItem,
  AccordionHeader,
  AccordionPanel,
  Text,
} from "@fluentui/react-components";
import { CacheDuplicates } from "../../types";

interface IApolloCacheItems {
  duplicatedCacheObjects: CacheDuplicates;
}

export const ApolloCacheDuplicatedItems = React.memo(
  ({ duplicatedCacheObjects }: IApolloCacheItems) => {
    const classes = useStyles();

    if (!duplicatedCacheObjects || !duplicatedCacheObjects.length) {
      return null;
    }

    return (
      <div className={classes.root}>
        <Accordion multiple>
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
                    <div>{key}</div>
                    <div>{JSON.stringify(value)}</div>
                  </div>
                ))}
              </AccordionPanel>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    );
  },
);
