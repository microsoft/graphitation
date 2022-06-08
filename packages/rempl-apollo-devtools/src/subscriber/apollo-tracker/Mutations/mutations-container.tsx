import React, { useState, useEffect, memo } from "react";
import { Mutation } from "../../../types";
import { remplSubscriber } from "../../rempl";
import { Mutations } from "./mutations";

const MutationsContainer = memo(() => {
  const [apolloTrackerMutations, setApolloTrackerMutations] = useState<
    Mutation[]
  >([]);
  useEffect(() => {
    const unsubscribe = remplSubscriber
      .ns("apollo-tracker-mutations")
      .subscribe((data: Mutation[]) => {
        if (data) {
          setApolloTrackerMutations(data);
        }
      });

    return () => {
      unsubscribe();
    };
  }, []);

  return <Mutations mutations={apolloTrackerMutations} />;
});

export default MutationsContainer;
