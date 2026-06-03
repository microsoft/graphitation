import { remplSubscriber } from "../rempl";
import * as React from "react";
import { IDataView } from "apollo-inspector";
import { OperationsTrackerContainer as Main } from "apollo-inspector-ui";
import { Observable } from "rxjs";
import { UnsubscribeFn } from "rempl/lib/utils";
import { CopyType } from "apollo-inspector-ui";

export const OperationsTrackerContainer = () => {
  const [clientObjects, setClientObjects] = React.useState<string[]>([]);

  const { onRecordStart, onRecordStop }: IUseOnRecordPayload =
    useOnRecord(clientObjects);

  useSubscribeToPublisher({ setClientObjects });

  const onCopy = useOnCopy();

  return (
    <Main
      onRecordStart={onRecordStart}
      onRecordStop={onRecordStop}
      apolloClientIds={clientObjects}
      onCopy={onCopy}
    ></Main>
  );
};

const useSubscribeToPublisher = ({
  setClientObjects,
}: {
  setClientObjects: React.Dispatch<React.SetStateAction<string[]>>;
}) => {
  React.useEffect(() => {
    const unsubscribe = remplSubscriber
      .ns("apollo-operations-tracker")
      .subscribe((data: IDataView) => {
        if (Array.isArray(data)) {
          setClientObjects(data);
        }
      });
    remplSubscriber.callRemote("getApolloClientsIds");

    return () => unsubscribe();
  }, [setClientObjects]);
};

interface IUseOnRecordPayload {
  onRecordStart: any;
  onRecordStop: () => void;
}
const useOnRecord = (clientObjects: string[]): IUseOnRecordPayload => {
  const unsubscribeRef = React.useRef<UnsubscribeFn>();
  const onRecordStart: any = useOnRecordStart(unsubscribeRef, clientObjects);
  const onRecordStop = useOnRecordStop(unsubscribeRef);
  React.useEffect(() => () => unsubscribeRef.current?.(), []);
  return { onRecordStart, onRecordStop };
};

const useOnCopy = () =>
  React.useCallback((copyType: CopyType, data: any) => {
    switch (copyType) {
      case CopyType.AllOperations:
      case CopyType.CheckedOperations:
      case CopyType.FilteredOperations:
      case CopyType.SelectedOperation:
      case CopyType.WholeApolloCache:
        {
          remplSubscriber.callRemote("copyOperationsData", { data });
        }

        break;
    }
  }, []);

const useOnRecordStop = (
  unsubscribeRef: React.MutableRefObject<UnsubscribeFn | undefined>,
) =>
  React.useCallback(() => {
    unsubscribeRef.current?.();
    remplSubscriber.callRemote("stopOperationsTracker", {});
  }, []);

let previousData: any = null;
const useOnRecordStart = (
  unsubscribeRef: React.MutableRefObject<UnsubscribeFn | undefined>,
  clientObjects: string[],
) =>
  React.useCallback(
    (selectedApolloClientIds: string[]) => {
      return new Observable<IDataView>((observer) => {
        remplSubscriber.callRemote("startOperationsTracker", {
          clientIds: selectedApolloClientIds,
        });
        if (unsubscribeRef.current) {
          unsubscribeRef.current();
        }
        unsubscribeRef.current = remplSubscriber
          .ns("apollo-operations-tracker")
          .subscribe((data: IDataView) => {
            if (!Array.isArray(data)) {
              if (doesDiffExist(previousData, data)) {
                observer.next(data);
              }
              previousData = data;
            }
          });
      });
    },
    [clientObjects],
  );

/**
 * Utility to compare if the previous list is same as current list of operations.
 * Its needed, as rempl subscriber keeps sending the previous sent data, every
 * 1 second, which is unnecessary
 * @param prevData
 * @param currentData
 * @returns
 */
const doesDiffExist = (
  prevData: IDataView | undefined,
  currentData: IDataView | undefined,
): boolean => {
  try {
    if (
      (prevData?.verboseOperations && prevData?.verboseOperations.length) ===
      (currentData?.verboseOperations && currentData?.verboseOperations.length)
    ) {
      let foundDifference = false;
      const prevDataMap = new Map();
      prevData?.verboseOperations?.forEach((operation) => {
        prevDataMap.set(operation.id, operation.changeSetVersion);
      });

      currentData?.verboseOperations?.forEach((operation) => {
        if (
          prevDataMap.has(operation.id) &&
          prevDataMap.get(operation.id) === operation.changeSetVersion
        ) {
          /** empty */
        } else {
          foundDifference = true;
          return true;
        }
      });
      return foundDifference;
    } else {
      return true;
    }
  } catch (error) {
    return true;
  }
};
