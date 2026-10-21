import type { FormEvent, ReactNode } from "react";
import { view } from "../../../../src/index";
import type { ResultOf } from "../../../../src/index";
import { stableJson } from "../protocol";
import { render, useData, useHandler } from "../react";
import type { DataRef } from "../react";
import { devtools } from "./state";
import type { DevtoolsContext } from "./state";
import { parseField } from "./Value";

type StoreAt = { readonly side: string; readonly store: string };

/** Shows a store's entries, watching them in place of the store shown before. */
export function selectStore(
  { side, store: name }: StoreAt,
  context: DevtoolsContext,
): void {
  const { read, store, send, key } = context;
  const previous = read(devtools.selected);
  if (previous !== null) {
    send(previous.side, { type: "unwatch", key: previous.key });
    store(devtools).forget(previous.key);
  }
  const watched = key();
  store(devtools).set({ selected: { side, store: name, key: watched } });
  send(side, {
    type: "watch",
    key: watched,
    target: { kind: "store", store: name },
  });
}

/** The value a store entry's form holds: JSON, or the text itself. */
const valueOf = (event: FormEvent<HTMLFormElement>): unknown => {
  event.preventDefault();
  return parseField(new FormData(event.currentTarget).get("value")) ?? null;
};

/** Handles an entry's submit: puts the form's value under its key. */
export async function saveEntry(
  { side, store, entry }: StoreAt & { readonly entry: unknown },
  { edit }: DevtoolsContext,
  event: FormEvent<HTMLFormElement>,
): Promise<void> {
  await edit(side, { store, operation: "put", entry, value: valueOf(event) });
}

export async function deleteEntry(
  { side, store, entry }: StoreAt & { readonly entry: unknown },
  { edit }: DevtoolsContext,
): Promise<void> {
  await edit(side, { store, operation: "delete", entry, value: null });
}

/** Handles the add form's submit: adds its value, its key in it. */
export async function addEntry(
  { side, store }: StoreAt,
  { edit }: DevtoolsContext,
  event: FormEvent<HTMLFormElement>,
): Promise<void> {
  const value = valueOf(event);
  event.currentTarget.reset();
  await edit(side, { store, operation: "add", entry: null, value });
}

/** A store's entries as its watch last answered them, each editable as its store permits. */
export const storeEntriesView = view({
  name: "Store entries",
  resolve: (
    { side, store, key }: StoreAt & { readonly key: string },
    { read, action },
  ) => {
    const info = read(devtools.listed, side)?.stores.find(
      (each) => each.name === store,
    );
    const answer = read(devtools.answer, key);
    const failed =
      answer?.failed ??
      (answer?.errors.length ? answer.errors.join("\n") : null);
    const entries = (answer?.value ?? []) as readonly {
      readonly key: unknown;
      readonly value: unknown;
    }[];
    return {
      title: `${side} · ${store}`,
      loading: answer === null,
      failed,
      entries: entries.map((entry) => ({
        id: stableJson(entry.key),
        key: typeof entry.key === "string" ? entry.key : stableJson(entry.key),
        text: JSON.stringify(entry.value, null, 2),
        save:
          info?.put === true
            ? action(saveEntry, { side, store, entry: entry.key })
            : null,
        remove:
          info?.delete === true
            ? action(deleteEntry, { side, store, entry: entry.key })
            : null,
      })),
      add: info?.add === true ? action(addEntry, { side, store }) : null,
    };
  },
});

/** Every side's stores, and the selected one's entries. */
export const storesTabView = view({
  name: "Stores tab",
  resolve: (_args: undefined, { read, ref, action }) => {
    const selected = read(devtools.selected);
    return {
      sides: read(devtools.sides).map((side) => ({
        side,
        stores: (read(devtools.listed, side)?.stores ?? []).map((info) => ({
          name: info.name,
          current: selected?.side === side && selected.store === info.name,
          select: action(selectStore, { side, store: info.name }),
        })),
      })),
      entries:
        selected === null ? null : ref(storeEntriesView, selected, render),
    };
  },
});

function StoreEntries({
  dataRef,
}: {
  readonly dataRef: DataRef<ResultOf<typeof storeEntriesView>>;
}): ReactNode {
  const store = useData(dataRef);
  const handler = useHandler();
  return (
    <section className="dt-entries">
      <h3>{store.title}</h3>
      {store.loading && <p className="dt-meta">Loading…</p>}
      {store.failed !== null && <p className="dt-failed">{store.failed}</p>}
      {!store.loading && store.entries.length === 0 && (
        <p className="dt-meta">No entries.</p>
      )}
      {store.entries.map((entry) => (
        // Keyed by its value too, so a change elsewhere resets what the form shows.
        <form
          key={`${entry.id} ${entry.text}`}
          className="dt-entry"
          onSubmit={handler(entry.save) ?? ((event) => event.preventDefault())}
        >
          <div className="dt-entry-head">
            <code>{entry.key}</code>
            {entry.save !== null && <button type="submit">Save</button>}
            {entry.remove !== null && (
              <button type="button" onClick={handler(entry.remove)}>
                Delete
              </button>
            )}
          </div>
          <textarea
            name="value"
            defaultValue={entry.text}
            readOnly={entry.save === null}
            rows={Math.min(12, entry.text.split("\n").length)}
            spellCheck={false}
          />
        </form>
      ))}
      {store.add !== null && (
        <form className="dt-entry" onSubmit={handler(store.add)}>
          <textarea
            name="value"
            placeholder="A new entry, as JSON"
            rows={3}
            spellCheck={false}
          />
          <button type="submit">Add</button>
        </form>
      )}
    </section>
  );
}

export function StoresTab({
  dataRef,
}: {
  readonly dataRef: DataRef<ResultOf<typeof storesTabView>>;
}): ReactNode {
  const tab = useData(dataRef);
  const handler = useHandler();
  return (
    <div className="dt-stores">
      <nav>
        {tab.sides.map(({ side, stores }) => (
          <div key={side}>
            <h3>{side}</h3>
            {stores.map((store) => (
              <button
                key={store.name}
                type="button"
                aria-pressed={store.current}
                onClick={handler(store.select)}
              >
                {store.name}
              </button>
            ))}
          </div>
        ))}
      </nav>
      {tab.entries === null ? (
        <p className="dt-meta">Pick a store.</p>
      ) : (
        <StoreEntries key={tab.entries} dataRef={tab.entries} />
      )}
    </div>
  );
}
