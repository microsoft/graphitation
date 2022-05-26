import React, { useEffect, useState, useCallback } from "react";
import { CacheDuplicates } from "../../types";
import { remplSubscriber } from "../rempl";

export type ApolloCacheDuplicatesContextType = {
  getCacheDuplicates: () => void;
  cacheDuplicates: CacheDuplicates;
} | null;

export const ApolloCacheDuplicatesContext =
  React.createContext<ApolloCacheDuplicatesContextType>(null);

export const ApolloCacheDuplicatesContextWrapper = ({
  children,
}: {
  children: JSX.Element;
}) => {
  const [cacheDuplicates, setCacheDuplicates] = useState<CacheDuplicates>([]);

  useEffect(
    () =>
      remplSubscriber
        .ns("apollo-cache-duplicates")
        .subscribe(function (data: CacheDuplicates) {
          if (data) {
            setCacheDuplicates(data);
          }
        }),
    []
  );

  const getCacheDuplicates = useCallback(() => {
    remplSubscriber.callRemote("getCacheDuplicates");
  }, [cacheDuplicates]);

  return (
    <ApolloCacheDuplicatesContext.Provider
      value={{
        cacheDuplicates,
        getCacheDuplicates,
      }}
    >
      {children}
    </ApolloCacheDuplicatesContext.Provider>
  );
};
