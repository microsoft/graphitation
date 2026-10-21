# Refresher

**A reactive data layer that composes data the way React composes UI.**

Refresher turns your application's data into live, composable query results,
keeps them up to date as the data changes, and tells consumers exactly what
changed and why.

> **Alpha.** Refresher is under active development. The core runtime —
> views, refs, store views, queries and live queries — works today. Federation,
> actions, the codec and error presentation are still being designed, and APIs
> may change between releases.

- **Familiar:** Views are like React components that return data. Arguments are
  props, `read` inlines another view, and `ref` is like rendering a child
  component: it draws an update boundary.
- **Bring your own data:** Refresher needs only two things from a data source:
  a way to read it, and a notification after it changes. In-memory state,
  IndexedDB, REST or GraphQL endpoints and server push channels can all feed the
  same view graph — several of them at once.
- **Granular updates:** A view reruns only when a change intersects what it
  read. A live query republishes only the parts that changed, so only the UI
  showing them re-renders.
- **Reliable:** Live queries publish complete results in order, never miss a
  change, and converge to the latest data. Execution is deterministic.
- **Type-safe:** Views, refs and query results are statically typed with
  TypeScript.
- **Framework-agnostic:** Refresher has no dependency on React and works with
  any UI framework.

## Installation

```sh
npm install @graphitation/refresher
# or
yarn add @graphitation/refresher
```

## Example

Here's a post with a like counter, kept live as the likes change:

```ts
import {
  createRuntime,
  createSimpleDriver,
  defaultEnvironment,
  storeView,
  view,
  type StoreChangeListener,
} from "@graphitation/refresher";

// Data your application already owns...
type Post = { id: string; title: string };
const posts = new Map<string, Post>([["1", { id: "1", title: "Hello" }]]);
const likes = new Map<string, number>([["1", 0]]);

// ...and a way to hear that it changed.
let revision = 0;
const listeners = new Set<StoreChangeListener>();
const feed = {
  subscribe(listener: StoreChangeListener) {
    listeners.add(listener);
    listener([], revision);
    return () => listeners.delete(listener);
  },
};

function likePost(postId: string) {
  likes.set(postId, (likes.get(postId) ?? 0) + 1);
  revision++;
  for (const listener of listeners) {
    listener([{ store: "likes", operation: "put", value: postId }], revision);
  }
}

// Store views: how to read your data, and which changes affect a read.
const postRecord = storeView({
  store: "posts",
  resolve: (id: string, { store }: { store: Map<string, Post> }) =>
    store.get(id),
  matches: (id, change) => change.value === id,
});

const likeCount = storeView({
  store: "likes",
  resolve: (id: string, { store }: { store: Map<string, number> }) =>
    store.get(id) ?? 0,
  matches: (id, change) => change.value === id,
});

// Views: compose them like components.
const postLikes = view({
  name: "postLikes",
  resolve: (postId: string, { read }) => read(likeCount, postId),
});

const postWithLikes = view({
  name: "postWithLikes",
  access: { queryable: true },
  resolve: (postId: string, { read, ref }) => ({
    post: read(postRecord, postId),
    likes: ref(postLikes, postId, { tags: ["likes"] }),
  }),
});

// Run a live query.
const runtime = createRuntime({
  env: defaultEnvironment,
  feed,
  store: (name) => (name === "posts" ? posts : likes),
});

const result = await runtime.query(
  postWithLikes,
  "1",
  createSimpleDriver(["likes"]),
);

result.subscribe({
  next(update) {
    if (!("output" in update)) return;
    for (const instance of update.output.roots) {
      console.log(instance.view.name, instance.data); // postLikes 1
    }
  },
});

likePost("1");
```

Think of `ref(postLikes, postId)` as `<PostLikes postId={postId} />` in React,
or as a field resolved by another resolver in GraphQL. Because `postLikes` sits
behind a ref, a new like reruns `postLikes` alone — `postWithLikes` doesn't
rerun, and the live query publishes just that part of the result.

## How it works

Refresher data layers are composed from three primitives:

- A **store** holds raw data. Refresher reads it through **store views** and
  learns about its changes from a **change feed**. Writes stay where they are
  today: your application keeps full control over how data is written and
  synchronized.
- A **view** is a side-effect-free computation, like a React component. Store
  views expose store state; derived views read other views and return values
  and refs.
- A **ref** is a serializable reference to a view and its arguments, like a
  React element.

A view consumes another view in one of two ways, and choosing between them is
the main design decision in a Refresher data layer:

- **Reading** inlines a value. The callee's result becomes part of the caller's
  result, and the caller reruns whenever it changes.
- **Returning a ref** delegates. The referenced view resolves separately, and
  when its result changes it refreshes without rerunning its parent. Refs are
  where you draw update boundaries, much as component boundaries decide what
  re-renders in React.

A **query** evaluates one root view and follows the refs its consumer demands —
once, or continuously as a **live query**. Each view records exactly what it
read, so when a change arrives only the views whose reads it intersects rerun.
Queries started together run as one batch, in rounds that load data together
instead of one record at a time.

If you know GraphQL, this will feel familiar: views act as enhanced resolvers,
and refs play the role of fields resolved by other resolvers. Refresher can even
run behind a GraphQL facade as its reactive execution engine — but GraphQL is
optional.

Refresher also has a sibling, the **transactional store**: a browser-first store
over memory and IndexedDB with atomic, MVCC/OCC writes. Refresher works on its
own; paired with the transactional store it adds snapshot-consistent results
and atomic visibility of multi-store writes, with the same view code.

## Learn more

Start with the [architecture overview](docs/architecture/overview.md), then dive
into the topics you need:

- [Views](docs/architecture/views.md) — reactive views, refs as update
  boundaries, and read tracking
- [Stores and change feeds](docs/architecture/stores.md) — store views,
  revisions, and matching changes against reads
- [Queries](docs/architecture/queries.md) — one-shot and live queries, batches,
  and publication
- [Execution](docs/architecture/execution.md) — waves, rounds, and query
  drivers
- [Guarantees](docs/architecture/guarantees.md) — the full contract Refresher
  upholds
- [Pagination](docs/architecture/pagination.md) and
  [Pins](docs/architecture/pins.md) — stable pages and answers over live data
- [Federation](docs/architecture/federation.md) — one view graph over the main
  thread, a worker and a server _(design in progress)_

The full list is in the [documentation index](docs/README.md).

For a complete application, see the
[federated chat example](examples/federated-chat/README.md): a chat whose data
lives in a worker over IndexedDB and on the main thread, with devtools that show
every store, query and update live.

## Requirements

Refresher uses ES2022 `Error` causes and `Object.hasOwn`. Its entry points
declare the narrow `es2022.error` and `es2022.object` library references, so
consumers may keep an ES2021 compilation target. No polyfills are installed;
the host must provide these APIs (Chromium/Edge 94+, Firefox 92+, Safari 15.4+,
or Node.js 16.9+).

## Contributing

Refresher lives in the [graphitation](https://github.com/microsoft/graphitation)
monorepo. From `packages/refresher`:

```sh
yarn build          # compile to lib/
yarn types          # type-check the package and its examples
yarn lint
yarn test           # node:test and fast-check property tests
yarn test:watch
yarn dev:federated-chat
```

See the repository's [contributing guide](../../CONTRIBUTING.md) for details.

## License

MIT
