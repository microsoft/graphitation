import React from "react";
import { ApolloGlobalOperations } from "../../types";
import { useStyles } from "./additional-info.styles";
import { Accordion, AccordionHeader, AccordionItem, AccordionPanel } from "@fluentui/react-components";

const panels = (globalOperations: ApolloGlobalOperations) => [
  {
    key: "0_global_queries",
    title: "Global Queries",
    items: globalOperations.globalQueries,
  },
  {
    key: "1_global_mutations",
    title: "Global Mutations",
    items: globalOperations.globalMutations,
  },
  {
    key: "2_global_subscriptions",
    title: "Global Subscriptions",
    items: globalOperations.globalSubscriptions,
  },
];

const AdditionalInformationsRenderer = React.memo(
  ({ globalOperations }: { globalOperations: ApolloGlobalOperations }) => {
    const classes = useStyles();
    return (
      <div className={classes.root}>
        <div className={classes.innerContainer}>
          <Accordion
            multiple
          >
            {panels(globalOperations).map((item, index) => (
              <AccordionItem value={index} key={item.key}>
                <AccordionHeader>
                 {item.title}
                </AccordionHeader>
                {item.items.map(elem => (
                  <AccordionPanel>
                    <div className={classes.infoItem}>
                      {elem}
                    </div>
                  </AccordionPanel>
                ))}
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </div>
    );
  }
);

export default AdditionalInformationsRenderer;
