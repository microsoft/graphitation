import React, { useContext } from "react";
import { ApolloGlobalOperationsContext } from "../contexts/apollo-global-operations-context";
import AdditionalInformationsRenderer from "./additional-informations-renderer";

const AdditionalInformationsContainer = React.memo(() => {
  const globalOperations = useContext(ApolloGlobalOperationsContext);

  return <AdditionalInformationsRenderer globalOperations={globalOperations} />;
});

export default AdditionalInformationsContainer;
