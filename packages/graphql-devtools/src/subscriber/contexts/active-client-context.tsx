import React, { useEffect, useState, useCallback } from "react";
import { Dropdown } from "../../components";
import { remplSubscriber } from "../rempl";

export const ActiveClientContext = React.createContext("");

export const ActiveClientContextWrapper = ({
  children,
}: {
  children: JSX.Element;
}) => {
  const [activeClientId, setActiveClientId] = useState<string>("");
  const [clientIds, setClientIds] = useState<string[]>([]);

  useEffect(() => {
    remplSubscriber.ns("apollo-client-ids").subscribe((data: string[]) => {
      if (data) {
        setClientIds(data);
      }
    });
  }, []);

  const onChange = useCallback((_: any, { value }: any) => {
    remplSubscriber.callRemote("setActiveClientId", value);
    setActiveClientId(value);

    window.REMPL_GRAPHQL_DEVTOOLS_RECENT_ACTIVITIES = [];

    remplSubscriber.callRemote("clearApolloTrackerMetadata");
  }, []);

  if (!activeClientId && clientIds.length) {
    remplSubscriber.callRemote("setActiveClientId", clientIds[0]);
    setActiveClientId(clientIds[0]);
  }

  return (
    <>
      <div>
        <Dropdown
          items={clientIds}
          onChange={onChange}
          value={activeClientId}
        />
      </div>
      {activeClientId ? (
        <ActiveClientContext.Provider value={activeClientId}>
          {children}
        </ActiveClientContext.Provider>
      ) : (
        <p>Loading...</p>
      )}
    </>
  );
};
