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
    remplSubscriber.callRemote("getApolloClientsIds");
    const unsubscribe = remplSubscriber
      .ns("apollo-operations-tracker")
      .subscribe((data: IDataView) => {
        if (Array.isArray(data)) {
          setClientObjects(data);
          unsubscribe();
        }
      });
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
        let skipValue = true;
        unsubscribeRef.current = remplSubscriber
          .ns("apollo-operations-tracker")
          .subscribe((data: IDataView) => {
            if (!Array.isArray(data) && !skipValue) {
              observer.next(data);
            } else {
              skipValue = false;
            }
          });
      });
    },
    [clientObjects],
  );
