import React, { useContext } from "react";
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

  return (
    <div className={classes.root}>
      <div className={classes.innerContainer}>
        <GraphiQL
          fetcher={createFetcher(activeClientId)}
          storage={getStorage()}
        />
      </div>
    </div>
  );
});

function getStorage(): Storage {
  const storage: { [key: string]: string | null } = {};

  return {
    get length() {
      return Object.keys(storage).length;
    },
    setItem: function (key: string, value: string | null) {
      storage[key] = value || "";
    },
    getItem: function (key: string) {
      return storage.hasOwnProperty(key) ? storage[key] : null;
    },
    removeItem: function (key: string) {
      delete storage[key];
    },
  };
}
export default GraphiQLRenderer;
