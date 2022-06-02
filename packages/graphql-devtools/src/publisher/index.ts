import { RemplWrapper } from "./rempl-wrapper";
import { ApolloCachePublisher } from "./publishers/apollo-cache-publisher";
import { ApolloCacheDuplicatesPublisher } from "./publishers/apollo-cache-duplicates-publisher";
import { GraphiQLPublisher } from "./publishers/graphiql-publisher";
import { ApolloTrackerPublisher } from "./publishers/apollo-tracker-publisher";
import { ApolloClientsPublisher } from "./publishers/apollo-clients-publisher";
import { ApolloGlobalOperationsPublisher } from "./publishers/apollo-global-operations-publisher";
import { ApolloRecentActivityPublisher } from "./publishers/apollo-recent-activity-publisher";

const remplWrapper = new RemplWrapper(
  "ctrl+shift+alt+0, command+shift+option+0",
);

new ApolloClientsPublisher(remplWrapper);
new ApolloCachePublisher(remplWrapper);
new ApolloTrackerPublisher(remplWrapper);
new ApolloGlobalOperationsPublisher(remplWrapper);
new GraphiQLPublisher(remplWrapper);
new ApolloCacheDuplicatesPublisher(remplWrapper);
new ApolloRecentActivityPublisher(remplWrapper);
