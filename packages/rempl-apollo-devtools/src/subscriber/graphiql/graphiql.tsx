import React, { useContext, useRef } from "react";
import GraphiQL, { Storage } from "graphiql";
import { ActiveClientContext } from "../contexts/active-client-context";
import { FetcherParams } from "../../types";
import { qraphiqlStyles } from "./graphiql.styles";
import { remplSubscriber } from "../rempl";

(window as any).global = window;

export const createSimpleFetcher = (activeClientId: string) => (
  graphQLParams: FetcherParams,
) =>
  new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      console.error("graiphql request timeout");
      reject();
    }, 3000);

    remplSubscriber
      .callRemote("graphiql", activeClientId, graphQLParams)
      .then((res: unknown) => {
        clearTimeout(timeout);
        resolve(res);
      });
  });

const createFetcher = (activeClientId: string) => {
  const simpleFetcher = createSimpleFetcher(activeClientId);
  return (graphQLParams: FetcherParams) => {
    return simpleFetcher(graphQLParams);
  };
};

export const GraphiQLRenderer = React.memo(() => {
  const activeClientId = useContext(ActiveClientContext);
  const classes = qraphiqlStyles();
  const storage = useRef(getStorage());

  return (
    <div className={classes.root}>
      <div className={classes.innerContainer}>
        <GraphiQL
          fetcher={createFetcher(activeClientId)}
          storage={storage.current}
        />
      </div>
    </div>
  );
});

function getStorage(): Storage {
  if (!window.GRAPHIQL_STORAGE) {
    window.GRAPHIQL_STORAGE = {};
  }
  const storage = window.GRAPHIQL_STORAGE;

  return {
    get length() {
      return Object.keys(storage).length;
    },
    setItem: function (key: string, value: string | null) {
      storage[key] = value || "";
    },
    getItem: function (key: string) {
      return key in storage ? storage[key] : null;
    },
    removeItem: function (key: string) {
      delete storage[key];
    },
  };
}
export default GraphiQLRenderer;
