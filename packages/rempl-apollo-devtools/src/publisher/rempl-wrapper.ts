import { createPublisher, getHost } from "rempl";
import hotkeys from "hotkeys-js";
import { ClientObject, WrapperCallbackParams, Publisher } from "../types";

declare let __APOLLO_DEVTOOLS_SUBSCRIBER__: string;
type RemplStatusHook = {
  id: string;
  timeout: number;
  callback: (wrapperCallbackParams: WrapperCallbackParams) => void;
};

export class RemplWrapper {
  private isRemplActive = false;
  private remplStatusHooks: RemplStatusHook[] = [];
  private activeClient: ClientObject | null = null;
  private checkIntervals: {
    id: string;
    interval: ReturnType<typeof setInterval>;
  }[] = [];
  publisher: Publisher;

  constructor(enableRemplHotkey: string) {
    this.publisher = createPublisher("apollo-devtools", () => {
      if (__APOLLO_DEVTOOLS_SUBSCRIBER__) {
        return { type: "script", value: __APOLLO_DEVTOOLS_SUBSCRIBER__ };
      } else {
        return {
          type: "url",
          value: window.__REMPL_APOLLO_DEVTOOLS_URL__ || "",
        };
      }
    });

    this.attachMethodsToPublisher(this.publisher);

    hotkeys(enableRemplHotkey, () => {
      this.toggleStatus();
    });
  }

  public subscribeToRemplStatus(
    id: string,
    callback: ({ clientObjects, activeClient }: WrapperCallbackParams) => void,
    timeout: number,
  ) {
    this.remplStatusHooks.push({ id, callback, timeout });
  }

  public unSubscribeToRemplStatus(idToCheck: string) {
    this.remplStatusHooks.filter(({ id }) => idToCheck !== id);
    this.checkIntervals.filter(({ id }) => {
      const result = idToCheck !== id;
      if (!result) {
        this.clearIntervalById(id);
      }
    });
  }

  public attachMethodsToPublisher(apolloPublisher: Publisher) {
    apolloPublisher.provide("setActiveClientId", (clientId: string) => {
      this.clearIntervals();
      this.activeClient = this.getClientById(clientId);
      this.runAllHooks();
    });
  }

  private getClientById(activeClientId: string) {
    if (!window.__APOLLO_CLIENTS__?.length) {
      return null;
    }

    const activeClient = window.__APOLLO_CLIENTS__.find(
      (client: ClientObject) => client.clientId === activeClientId,
    );

    if (!activeClient) {
      return null;
    }

    return activeClient;
  }

  private intervalExists(idToCheck: string) {
    return this.checkIntervals.some(({ id }) => id === idToCheck);
  }

  public runAllHooks() {
    if (!window.__APOLLO_CLIENTS__?.length) {
      return;
    }

    for (const { id, callback, timeout } of this.remplStatusHooks) {
      if (this.intervalExists(id)) {
        return;
      }

      callback({
        clientObjects: window.__APOLLO_CLIENTS__,
        activeClient: this.activeClient,
      });

      this.checkIntervals.push({
        id: id,
        interval: setInterval(() => {
          callback({
            clientObjects: window.__APOLLO_CLIENTS__,
            activeClient: this.activeClient,
          });
        }, timeout),
      });
    }
  }

  private clearIntervalById(idToCheck: string) {
    for (const { id, interval } of this.checkIntervals) {
      if (id === idToCheck) {
        clearInterval(interval);
      }
    }
    this.checkIntervals = [];
  }

  private clearIntervals() {
    for (const { interval } of this.checkIntervals) {
      clearInterval(interval);
    }
    this.checkIntervals = [];
  }

  private toggleStatus() {
    this.isRemplActive = !this.isRemplActive;
    this.clearIntervals();

    if (this.isRemplActive) {
      getHost().activate();

      this.runAllHooks();

      return;
    }

    getHost().deactivate();
  }
}
