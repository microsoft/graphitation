import type { ReactNode } from "react";
import { view } from "../../../../src/index";
import type { Ref, ResultOf } from "../../../../src/index";
import { render, useHandler, useQuery } from "../react";
import { devtools } from "./state";
import type { DevtoolsContext, Tab } from "./state";
import { ActivityTab, activityTabView } from "./ActivityTab";
import { StoresTab, storesTabView } from "./StoresTab";
import { ViewsTab, viewsTabView } from "./ViewsTab";

const TABS: readonly Tab[] = ["activity", "stores", "views"];

export function selectTab(tab: Tab, { store }: DevtoolsContext): void {
  store(devtools).set({ tab });
}

export function dismissError(
  _args: undefined,
  { store }: DevtoolsContext,
): void {
  store(devtools).set({ error: null });
}

export const devtoolsView = view({
  name: "Devtools",
  access: { queryable: true },
  resolve: (_args: undefined, { read, ref, action }) => {
    const tab = read(devtools.tab);
    return {
      tabs: TABS.map((name) => ({
        name,
        current: name === tab,
        select: action(selectTab, name),
      })),
      error: read(devtools.error),
      dismiss: action(dismissError),
      activity:
        tab === "activity" ? ref(activityTabView, undefined, render) : null,
      stores: tab === "stores" ? ref(storesTabView, undefined, render) : null,
      views: tab === "views" ? ref(viewsTabView, undefined, render) : null,
    };
  },
});

export function Devtools({
  root,
}: {
  readonly root: Ref<ResultOf<typeof devtoolsView>>;
}): ReactNode {
  const tools = useQuery(root);
  const handler = useHandler();
  return (
    <div className="dt">
      <div role="tablist" className="dt-tabs">
        {tools.tabs.map((tab) => (
          <button
            key={tab.name}
            type="button"
            role="tab"
            aria-selected={tab.current}
            onClick={handler(tab.select)}
          >
            {tab.name}
          </button>
        ))}
      </div>
      {tools.error !== null && (
        <p className="dt-failed" role="alert">
          {tools.error}{" "}
          <button type="button" onClick={handler(tools.dismiss)}>
            Dismiss
          </button>
        </p>
      )}
      {tools.activity !== null && <ActivityTab dataRef={tools.activity} />}
      {tools.stores !== null && <StoresTab dataRef={tools.stores} />}
      {tools.views !== null && <ViewsTab dataRef={tools.views} />}
    </div>
  );
}
