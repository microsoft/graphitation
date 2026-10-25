# Federated chat

A chat whose data lives in two runtimes, rebuilt on the v2 runtime with the
federation design of [federation.md](../../docs/architecture/federation.md):

- **The worker** owns IndexedDB. Its runtime runs the chat's data graph
  (`worker/views/*`) and publishes four queryable roots: `chats`, `newestChatOnOpen`, `room`
  and `pageBefore`.
- **The main thread** owns UI state and pending messages, in a small
  synchronous store (`main/stores/ui.ts`). Its views are layered over the worker's:
  they take the worker's external refs as arguments and read them with
  `read(worker.views, ref)`. Only actions start and stop the worker's queries.
- **The worker's writes** are its own actions (`worker/actions.ts`): its views
  offer them as action refs, and the main thread runs them by sending them back.

The example is also a probe: whatever v2 lacks is filled in `lib/`, not in
`src`, and listed under [Gaps](#gaps).

```sh
yarn dev:federated-chat      # http://localhost:5181
yarn build:federated-chat
yarn preview:federated-chat  # http://localhost:4181
```

The devtools beside the chat (`lib/devtools/`), opened and closed by the button in the bottom-right corner (closed at first) and resized by dragging the gap before them (a double click resets), have three tabs:

- **Stores**: every store of both runtimes, live. Each entry of the UI store and
  of the worker's IndexedDB stores can be edited as JSON, added or deleted, and
  the chat follows.
- **Activity**: a timeline per runtime, main on the left and the worker on the
  right (or either one alone), the newest at the bottom. Each entry is one
  line, expanding on click: a store change to what each store changed; a
  query (a query, a live update or a read) to the changes that updated it and
  the instances it evaluated, listed in the batch of queries one pass ran, or
  in the action that read it; an action or a message to what it carried,
  answered or threw. An action lists what it read and the actions it ran or
  answered with, the worker's among them. A message links to its counterpart
  on the other side, an action sent to the worker to the one the worker ran,
  a change to its store change. Both runtimes' revisions are hybrid logical clocks
  (`lib/clock.ts`), and every message carries its sender's, so both timelines
  share one time axis.
- **Views**: every view of both runtimes. Running one watches it live in a
  frame; a ref it answers opens its own frame, in either runtime, and an action
  ref runs, asking for its open inputs.

To watch what waits on the worker, pick a latency in the activity tab's toolbar
(0 at first): every message from the worker then arrives that many milliseconds
late.

Any message can be liked, by any number of users: a row shows the 3 who liked it last
and how many more did. Once You like one, the worker asks in the chat how many more likes
it gets: answering with a number from 0 to 10 adds that many from made-up users, and -1
takes your like back. Each message's likes are an instance of their own (`likes`), so a
like reruns only it. A like shows at once, as a sent message does: the UI store keeps it
(`liking`) until the worker's answer shows it too. Each press asks the worker for a state, not
a toggle, so only the latest press counts: answers to those before it are ignored.

## Layout

| Path                           | What it is                                                                                                                                         |
| ------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `worker/stores/chats.ts`       | The chats store `chats`, an `idbStore` keyed by id, and `withMessage`.                                                                             |
| `worker/stores/messages.ts`    | The messages store `messages`, with its `byChat` index, and `sentIn` for a chat's ranges of it.                                                    |
| `worker/stores/likes.ts`       | The likes store `likes`, keyed by message and user, by message and chat, and `likesOf` for their ranges.                                           |
| `worker/db/database.ts`        | Opens the database over its stores, seeds it (`seed.ts`), and runs a `write` across them.                                                          |
| `worker/views/*`               | The worker's data graph, linked by refs tagged `sidebar` or `room` (`tags.ts`).                                                                    |
| `worker/actions.ts`            | The worker's actions, each one database `write`: `sendMessage`, `likeMessage`, `askLikes`, `answerLikes`, `createChat`, `deleteChat`, `sendReply`. |
| `worker/main.ts`               | The worker's runtime, and its host, publishing its views and actions.                                                                              |
| `main/stores/ui.ts`            | The UI store `ui`: its state, a view per key (`ui.selected`, `ui.room`, `ui.menu`…), its writer.                                                   |
| `main/stores/worker.ts`        | The remote store `worker`, its four queries and their roots' ref types, and `messageRef`.                                                          |
| `main/worker.ts`               | The port: the remote connection, what it sends and receives, and the actions' `Services` and `AppContext`.                                         |
| `main/components/*`            | One view per component, with the actions it offers, in the component's own file.                                                                   |
| `main/main.tsx`                | Wires the runtime, the client, and `run` with the UI store's writer and the worker's actions.                                                      |
| `lib/protocol.ts`              | Encoded refs and action refs, and the messages between the two runtimes.                                                                           |
| `lib/host.ts`                  | The answering side: runs remote queries with the simple driver, answers, pushes restarts, runs action refs.                                        |
| `lib/remote.ts`                | The asking side: a remote store, its external views, refs, and `views`; `run` sends action refs back.                                              |
| `lib/actions.ts`               | The runner: runs an action with `read`, `ref`, `action`, `store`, `run` and services, and takes its answer.                                        |
| `lib/react.tsx`                | A client over the runtime, and the hooks: `useQuery`, `useData`, `useHandler`, `useActionEffect`.                                                  |
| `lib/clock.ts`                 | A hybrid logical clock: each runtime's revisions, ticking past every revision a message arrives with.                                              |
| `lib/feeds.ts`                 | Merges the UI store's feed and the remote feed into the runtime's one feed, on the main runtime's clock.                                           |
| `lib/driver.ts`                | The simple driver, reached by a deep import.                                                                                                       |
| `lib/idb/store.ts`             | `idbStore`: an object store read by key (`byId`), whole (`all`), or by ranges of a key path (`range.byChat`).                                      |
| `lib/idb/database.ts`          | `openIdb`: opens a database of `idbStore`s, feeds its changes, and runs writes in one transaction.                                                 |
| `lib/idb/requests.ts`          | IndexedDB requests, transactions and cursor walks as promises.                                                                                     |
| `lib/devtools/mount.tsx`       | The devtools: a Refresher application of their own, with a store, views and actions, rendered by the hooks.                                        |
| `lib/devtools/inspector.ts`    | What each runtime serves the devtools: its views and stores listed, watched, run and edited.                                                       |
| `lib/devtools/trace.ts`        | `createTracer`: a runtime's revisions, passes, queries, actions and messages, as activity.                                                         |
| `lib/devtools/ActivityTab.tsx` | The activity timelines, their links between entries and their expandable details.                                                                  |
| `lib/devtools/describe.ts`     | Values as plain data, refs and action refs as markers the devtools follow or run.                                                                  |
| `lib/devtools/protocol.ts`     | The messages between the devtools and each inspector, over a link of their own.                                                                    |

## How the runtimes meet

External refs are encoded refs, plain strings: `stableJson([viewId, args])`,
typed by a type-only import of the worker's views, so the main bundle holds no
worker code.

```ts
export const worker = remoteStore("worker");
export type SidebarFollowed = ResultOf<typeof chat>;
export type PageFollowed = ResultOf<
  typeof page | typeof message | typeof profile
>;
export type RoomFollowed =
  | PageFollowed
  | ResultOf<typeof chat | typeof pageBefore>;
export type NewestChatFollowed = RoomFollowed | ResultOf<typeof chatRoom>;
export const chatsQuery = worker.external<typeof chats, SidebarFollowed>(
  ids.chats,
  ["sidebar"],
);
export const newestChatQuery = worker.external<
  typeof newestChatOnOpen,
  NewestChatFollowed
>(ids.newestChatOnOpen, ["room"]);
export const roomQuery = worker.external<typeof chatRoom, RoomFollowed>(
  ids.room,
  ["room"],
);
export const pageQuery = worker.external<typeof pageBefore, PageFollowed>(
  ids.pageBefore,
  ["room"],
);
```

The queries are descriptors, not views: no view can read them,
so no view starts a query. Actions do, through the `queries` service.
`queries.open(roomQuery, chatId)` starts the worker's `room` query, or joins
it, and answers with the external ref to its root once the worker's first
answer arrives: `read(worker.views, ref)` reads its result. `queries.close(roomQuery, chatId)` lets it go once every
opener closed it. The host runs a query with a simple driver following the
given tags, so one answer carries every instance the room renders: its
summary, its latest page, the page's messages, and each author's profile. Refs in answers arrive as
external refs, followed as the query's second type argument says: a ref whose
result is in `RoomFollowed` is a followed ref, and any other can only be passed
on. The declaration is taken on trust, so it must match the tags.

Each instance an open query brought is read synchronously by its external ref:
`read(worker.views, ref)`, the remote store's view keyed by followed refs,
typed by the ref. Actions keep the roots they opened in the UI store, as
`ui.chatsRef` and `ui.room`, and views read the worker through them alone, so
every view settles synchronously and none waits for the worker.

`App` reads only the UI store. Every view below it takes external refs in its
arguments, never the data they name, so its key stays cheap: `Sidebar` takes
the root of `chatsQuery`, the chat on screen and the one navigated to, and
reads the list itself; `Room` takes its room's root; `Menu` takes the chat's
summary; `ChatLink` a chat's summary, and whether it is on screen or pending.

Queries opened in one event go in one `query` message, so they start in one pass on
the worker, at one revision. The host answers a pass in one `results` message: the
first answers of the queries it started and the pushes of those it restarted, once
each has run. The remote store takes a message whole, in one store change. Pushes
announce only the instances whose answers changed, through the remote feed, so
the main runtime restarts only what read them.

Liveness is the actions' to manage. Closing a query announces nothing: a view
still showing what it brought keeps it, and is no longer updated.

## Rendering

`lib/react.tsx` runs one query per `useQuery` root with a simple driver
following `render`. Refs made with `render` meta are followed by their parent's
query, so their components read them with `useData` and never suspend. The app
has one root, `App`, and since no view waits for the worker, its whole tree
settles in one pass.

Every instance any query reached is kept by id, and a component re-renders only
when its own instance changes.

So views, not components, derive what renders: an instance outlives a
component unmounted and mounted again, and re-resolves only when what it read
changes. `MessageRow`'s view formats the time and names the row's class, and
the worker's `profile` its avatar's colour; components only place values.

Components receive refs encoded, the way another runtime would: the client
encodes the main runtime's refs and action refs as it keeps an instance, and
the worker's arrive encoded. A component reads either kind with `useData`, keys
a list by the ref itself, and makes an event handler of an action ref with
`useHandler`. So a view can hand
a worker ref straight down: `MessageRow` passes the author's profile ref to
`Avatar`, which reads it from the worker's answers with no main-thread view in
between.

## Actions

A component never calls an action itself. Its view offers actions as data: a view
returns `action(deleteChat, chatId)` where an action applies, and the component makes
an event handler of whatever it received with `handler(ref)`, from `useHandler()`.
The client makes one handler per ref, and keeps it while a view offers the ref, so
calling `handler` in a loop or on every render allocates nothing, and a ref a view
offers only at times, `null` otherwise, makes no handler. `useActionEffect(ref)`
runs one as an effect instead: on mount, and again when the ref or its inputs
differ.

```ts
deleteChat: chat === null ? null : action(deleteChat, { chatId: chat.id, remove: chat.delete }),
```

```tsx
<button disabled={menu.deleteChat === null} onClick={handler(menu.deleteChat)}>
```

An action is a plain function, next to the view that offers it: `selectChat` and
`previewRoom` in `ChatLink.tsx`, `deleteChat` in `Menu.tsx`, `bootApp` in `App.tsx`.
Its first parameter is the arguments its ref
carries, its second its context: a view's `read`, `ref` and `action`,
`store`, `run`, and the application's services, and an event handler's third the
event. `run` (`lib/actions.ts`) calls it on the main thread, at once, so it may
still prevent the event's default.

A store's members are its views, and an action reads them as a view does.
`store(ui)` opens the store's writer, whose write surface is the store's own:

```ts
export function toggleMenu(
  _args: undefined,
  { read, store }: AppContext,
): void {
  store(ui).set({ menu: !read(ui.menu) });
}
```

A read is a one-shot query at the latest revision, so it sees every write made
before it, and answers synchronously unless the view may wait. The UI store's
writer writes it, and its feed restarts every query the write reaches: only
the views it made stale run again, in the pending pass.

Only the worker writes its data, so its views offer the actions that change
it, and the main thread's actions run them, through `run`. Only actions start
and stop the worker's queries, through `queries`, a service of the
application's. Navigating is one:

```ts
export async function selectChat(
  chatId: string,
  { read, store, queries }: AppContext,
) {
  if (read(ui.selected) === chatId) return;
  let room = queries.reopen(roomQuery, chatId);
  if (room === undefined) {
    store(ui).set({ navigating: chatId });
    room = await queries.open(roomQuery, chatId);
    if (read(ui.navigating) !== chatId) return queries.close(roomQuery, chatId);
  }
  const left = read(ui.selected);
  store(ui).set({ selected: chatId, room, navigating: null });
  if (left !== null) closeSelected(left, queries);
}
```

`queries.reopen` answers at once with the room's ref if the worker store still
holds its answer, and opens its query again in the background. Once a query is
closed, the store
[stops observing](../../docs/architecture/stores.md#when-a-store-stops-observing)
what only that query brought: it says so with a change, and answers it stale,
as of the close, until a query brings it again. So a room left a moment ago
shows stale, and once its reopened query answers, its views run again: every
view of an answer that changed, and of an unchanged one only those that read it
stale. A live query that stops reaching an instance, as when a message leaves
the page, lists it as dropped in its push, and the store stops observing it the
same way unless another query still brings it. Any other
room is opened, and waits for its first answer: until then, the room on screen
stays and its link shows as pending (`aria-busy`). A navigation started
meanwhile wins, and the room it superseded is closed. Every remote wait is an
action's, so none hides in a view.

Above the composer, a status line tells whether the room syncs. The store's
`opening` view reads `true` for a query's root until the query answers, so
meanwhile the room shows "Syncing…", and "Live" once a live query brings it.

Starting waits once, for two queries in parallel: `bootApp`, run once at
start, runs `bootSidebar` and `bootChat` with `Promise.all`, and clears
`ui.booting` once both are done, which shows the application. `bootSidebar`
opens `chatsQuery` for good, and the sidebar reads the list by its root.
`bootChat` opens `newestChatQuery`, whose root refers to the most recently
active chat, following `room` as a room's query does, reads that chat's id and
room, and puts the room on screen. The selection holds the newest chat's query: `closeSelected` closes it
with the room's, when navigating away or deleting the chat, so it stays open
only until the first selection.

The root is `newestChatOnOpen`, a [pin](../../docs/architecture/pins.md) to
`room`: the query keeps its ref to `room(id)`, and does not run it again. Its
ref takes no tag: the wave that runs the pin runs `room` too, and the query
follows `room` from there. Until the first selection, the room on
screen stays the one opened at start, and stays live, even when another chat
becomes the newest.

## Pagination

A room shows its messages a page at a time, at most three pages at once, between
an "Older messages" and a "Newer messages" button. Pages are
[pinned ranges](../../docs/architecture/pins.md#pagination). `pageBefore({chatId, before})`
is a pin: it reads the five messages sent last before `before` and answers
with a ref to `page({chatId, from, to})`, the range they covered, `to` being
`before`. A page reads every message sent in its range, so a message sent into
it joins it rather than pushing another onto the next page, and it offers
`older`, the args of the `pageBefore` that finds the page before it, from its
own `from`, or `null` when no message is older. So pages neither overlap nor
leave gaps.

The latest page is `pageBefore` with `before: null`: open-ended, so new
messages join it. The room refers to it as `latest`, so the room's query keeps
it, and reopening the room asks for the latest five again. Every older page is
a query of its own, `pageQuery`, which `showOlder` opens with the oldest page's
`older`. The UI store holds the older pages found so far, `ui.pages`, newest
first, and how many of the room's pages, the latest first, the list hides,
`ui.skip`. With three pages on screen, `showOlder` hides the newest, closing its
query unless it is the latest page; `showNewer` reopens the page after the
newest on screen, from what the worker store kept of it, and closes the oldest.
Opening waits for the worker; if the list moved or the chat was left
meanwhile, the action closes what it opened and does nothing. Navigating closes
the older pages' queries with the room's, and resets the list to the latest
page.

`previewRoom`, run as the pointer enters a chat, opens its room and
closes it ten seconds later, so selecting it within that time navigates at once.
It is off for now (commented out in `ChatLink.tsx`), as it adds noise to the
devtools' activity.

An action may answer with a ref or an action ref, and `run` takes the
answer as a page's links: it preloads a ref, and runs an action ref next.
`createChat` answers with `action(selectChat, chatId)`, so the new chat opens
once the worker has created it, and `deleteChat`, for the chat on screen, with
the next one's.

`Composer` offers `sendMessage` bound to its chat, and makes its form's submit
handler of it. The event is not an argument: an action ref's arguments are data,
which the codec captures and keys, so only a handler passes it, and only to the
runtime's own action; one for another runtime's ref throws.

```ts
submit: action(sendMessage, { chatId, send }),
```

```tsx
<form className="composer" onSubmit={handler(composer.submit)}>
```

An argument only the actions have, such as a new message's id, is left open
with `input(name)`, and an action's `run` binds it with values before running
the action. `run` fails to compile without a value for each open input, or with
one of the wrong type. A handler binds them too: `handler(ref, inputs)` makes
a new one each render, binding the inputs then, so a wrong one throws to the
nearest `DataBoundary`. An action ref an action answers with takes its inputs'
defaults.

The worker's writes are its own actions (`worker/actions.ts`), and its views
offer them as data too: a room offers `send`, with the message's id and text
left open, a chat's summary `delete`, and the list `create`.

```ts
send: action(sendMessage, { chatId, id: input("id"), text: input("text") }),
```

The host encodes an action ref as `stableJson({ action, args })`, by the id the
worker publishes its action under, each open input a `{ "$input": name }`
marker. The main thread holds it as an external action ref, typed by the
action and the inputs it leaves open:
`ExternalActionRef<typeof sendMessage, { id: string; text: string }>`. It is
data, so views pass it on as an argument, and the main thread's actions run it
with `run`, which sends it back with values for its inputs: the host binds
them, runs the action, and replies with what it answered.

```ts
export async function sendMessage(
  { chatId, send }: { readonly chatId: string; readonly send: SendRef },
  { store, run }: AppContext,
  event: FormEvent<HTMLFormElement>,
): Promise<void> {
  event.preventDefault();
  // The text, from the form.
  const id = crypto.randomUUID();
  store(ui).addPending({ id, chatId, text, sentAt: Date.now() });
  try {
    await run(send, { id, text });
  } catch (error) {
    store(ui).dropPending(id);
    throw error;
  }
}
```

So the optimistic write stays on the main thread, around the worker's.
`createChat` runs the worker's `create`, and selects the chat its id names.

Whether an action is offered is live data:
`Menu` offers `deleteChat` only while a chat is active, and `ChatLink`
offers `selectChat` only for a chat that is not.

## Optimistic updates

A write to the UI store renders in the task that made it: the main thread's
`createMainThreadEnvironment` starts the pending pass, which restarts the queries
the write reaches, in a microtask. Sending a message adds it to `pending`; the latest page shows the worker's rows, then every pending message no
row confirms yet, while the list shows it. The worker's `send` writes it, and once the worker's answers
hold the message, it is pruned. A rejected send removes it.

## Gaps

What v2 lacks, as this example found it. Each is filled in `lib/` or worked
around in place.

**Exports and typing**

- `createSimpleDriver` is not exported (`lib/driver.ts` deep-imports it), nor
  `isRef`, nor the JSON codec.
- `src` has no `external()` implementation: the example declares external views
  as store views of the remote store (`lib/remote.ts`).
- Making an external ref is a cast: `worker.ref` casts the encoded string.
- A `storeView` call generic over a key (`field<K>(key)`) defeats its overloads;
  each field is declared on its own.
- A `storeView` over a record type parameter doesn't resolve its result type
  (`StoreData<Settled<…>>` stays deferred): `idbStore` builds its views over
  `unknown` and casts the store once. A recursive key type in arguments makes
  result types instantiate too deep, so `IdbKey` nests arrays two deep.

**Stores**

- No IndexedDB store: `lib/idb/` is new. Each read (a record by key, every record,
  and a key path's
  ange, keyRange and count) is a store view matching changes by the keys
  a record had before and after, so views over it match nothing by hand. A read
  with a `limit` matches up to its last key, its footprint; a `put` reads the
  record it replaces to announce both.

**Federation**

- No remote store, host, or protocol: `lib/protocol.ts`, `lib/host.ts` and
  `lib/remote.ts` are all new.
- Encoding a result's refs and action refs needs a deep walk of the example's
  own, telling them apart with `isViewRef` and `isActionRef`.
- The runtime takes one feed: `lib/feeds.ts` merges sources onto a clock of its
  own (`lib/clock.ts`), so a source's revisions are lost and store views can't annotate in the
  runtime's clock. The remote store reads the runtime's clock once its change
  arrived, through `latestRevision`, to answer stale as of a close.
- Store views have no lifecycle, so nothing ties a remote query to the views
  reading what it brought: actions open and close queries. Closed, the store
  keeps what only that query brought, answering it stale, up to `keep`
  instances; a view reading one it dropped, or one no query brought, fails.
  First answers are announced, so it reads again once a query brings it.
- No read-your-writes signal: pending messages are pruned by checking whether
  the remote answers hold the message.
- The simple driver keeps no footprint, so instances a query no longer reaches
  stay in the host's answers and the client's cache until the query ends.
- The runtime exposes no pass boundaries: the host wraps each query's driver and
  takes the queries started or restarted in one task at one revision as one pass,
  sending their results once all have run.
- A query's output does not say which ref each instance answers: the host
  takes the first run's root as the root, and answers it under the ref the
  query was opened by.

**Runtime and queries**

- No retention policy: `trim` is called on a timer in both runtimes.
- Incremental results are not handled; the simple driver never produces them.
- `resolveBatch` never answers synchronously, so store views that must settle
  synchronously use `resolve`.

**Actions**

- No query takes variables: the simple driver binds only defaults, so no view
  here leaves an input open; only action refs do, for `run` to bind.
- The contract's `InputsParams`, which types the values `bind` takes, is not
  exported: `lib/actions.ts` repeats it to type `run`.
- Refresher ships no runner, and no mutations: `lib/actions.ts` runs actions with a context
  of its own. Without transactions, each `read` is a one-shot query of its own
  and each write applies at once, so an action's reads may see different
  revisions, and nothing rolls back: `sendMessage` drops its pending message
  itself when the send fails.
- A store carries no writer: `WritableStore` (`lib/actions.ts`) adds a type-only
  `signature` naming its writer's type, and `storeWriter(ui, writer)` pairs the
  store with the writer `store(ui)` opens.
- No encoding of action refs across runtimes: `lib/protocol.ts` encodes them as
  `stableJson({ action, args })`, by ids `worker/main.ts` publishes by hand
  (`actionIds` in `shared.ts`), and open inputs as `{ "$input": name }` markers
  of the example's own; telling an open input apart takes `isOpenInput`,
  deep-imported from `src/views/input`.
- The main thread types the worker's action refs by a type-only import of
  `worker/actions.ts`.
- Nothing reads outside a view: the action context's `read` wraps each view it
  reads in a queryable view, so a query can start from it. A ref made outside a
  view is a root, so its `ref` takes only queryable views.
- Nothing makes an action ref outside a view, as starting the application
  does: `actions(runtime)` (`lib/actions.ts`) makes them, and telling refs
  from action refs takes `createActionRef`, `isViewRef` and `isActionRef`,
  deep-imported from `src/views/ref`.

**React**

- No React integration: `lib/react.tsx` is new. It merges instances across
  queries by revision, keeps them by id, and retains roots while mounted.
- Nothing encodes a runtime's own refs for a component: the client walks each
  instance it keeps, encoding view refs by the codec's instance key and action
  refs by its action keys, and maps the encoded action refs back for `run`.
- No action takes an event: bound arguments are data the codec captures, so an
  event cannot be an input. `useHandler` passes it to the runner, which hands it
  to the action as a third parameter of the example's own.
- The contract's `ExternalRefResult` and `ExternalRefFollowed` are not
  exported: `useData` repeats them to type what an encoded ref reads.

**Devtools**

- No devtools: `lib/devtools/` is new, and runs as a Refresher application of
  its own.
- Nothing lists a runtime's views: `viewsIn` walks module namespaces and stores
  for objects `internalsOf` (deep-imported from `src/views/definitions`) knows.
- A runtime has no hooks: `createTracer` wraps its feed to trace each revision,
  and the runtime in a `Proxy` to trace each query, wrapping its driver to
  trace each restart and group them in passes; the runner takes a `scope`
  that each action runs in, and its reads and runs in the scope it gives
  them, to trace what an action did; and each port traces its messages. An
  action's read is its own only as far as the driver starts it synchronously,
  and the worker's action is the sent one's as it starts in the task the
  message arrives in.
- Revisions are numbers the application picks, with nothing to relate two
  runtimes' revisions: each runtime ticks a hybrid logical clock of its own,
  and every message carries its sender's latest revision for the receiver's
  clock to pass.
- A store has no generic way to list or edit its entries: the UI store and the
  remote store add an `entries` store view, and the worker lists IndexedDB
  records through `all`, writing through the database's `write`.
- Actions are named only by their functions' names, so the build keeps names
  (`keepNames` in `scripts/federated-chat.ts`).
