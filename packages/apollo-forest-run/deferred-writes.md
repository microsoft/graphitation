# Deferred writes: maintainer handoff

This branch addresses [apollographql/apollo-client#13530](https://github.com/apollographql/apollo-client/issues/13530)
for Apollo Client **3.14.0**, Forest Run and Supermassive. It is not a general fix
for `InMemoryCache`. The decision is to bind targets in Forest Run and retain
per-request delivery history in Apollo. These solve different problems.

## Reproduce the distinction

1. Watch a query for `messages { id text ... @defer { name } }`. The initial
   response contains M1 and announces `pending: [{ path: ["messages", 0] }]`.
2. Prepend M2 in the cache. The cache now contains `[M2, M1]`.
3. Emit `{ path: ["messages", 0], data: { name: "Alice" } }` in `incremental`,
   leaving the request open. The patch belongs to M1, not to the current row 0.
4. Start a **second** `watchQuery` for the same document and variables. Without
   another network emission, the order must remain `[M2, M1]`, Alice must
   remain on M1, and a field merge policy must not run again on this branch.
   A later patch at that same path with `"Bob"` must still update M1.

Step 3 is the entity-routing bug. Step 4 tests a stronger guarantee: stock
Apollo 3.14.0 deduplicates the network request, not cache writes across
`QueryInfo` instances. With stock `InMemoryCache`, one patch and a late
`network-only` watcher invoked the field's `merge` twice on **one** request.
The index in this branch is not necessary to identify M1.

## Who owns what

| Component | Responsibility |
| --- | --- |
| Supermassive | Announces pending paths in the initial response. Subsequent patches use the existing absolute response paths (including aliases and list indices). |
| Forest Run | Determines **where** to write. [`registerPlaceholders` and `embedInOwner`](./src/cache/write.ts) use the indexed initial response to bind original owners; [`ForestRun`](./src/ForestRun.ts) keeps the bindings in a `WeakMap` keyed by token identity. |
| Apollo | Determines **whether** to write and what to deliver to each observer. In the [installable 3.14.0 Yarn patch](../../.yarn/patches/@apollo-client-npm-3.14.0-ad9c6cfbc6.patch), `QueryManager` tracks link emissions before multicast/replay. `QueryInfo` applies accepted writes and reads the cache back. |

`registerPlaceholders` iterates **only** the announced paths. For each, it walks
from root through the endpoint (inclusive), not the entire tree. For
`messages[0].author`, if `author` has no key, registration remembers M1 and
the suffix `["author"]`. If `author` has a key, it remembers that author and an
empty suffix instead. Embedded targets use their current field/index below the
bound owner in the original operation. `embedInOwner` builds a sparse object,
preserves `__typename` and list siblings, and skips a missing target. The latest
cleanup made the path bound explicit and removed its four embedding casts.

The token is an opaque object to Forest Run. Apollo reuses its write cursor as
that object rather than allocating a second one. Each tracked link emission
gets `execution.results.push(result) - 1`: `0` for the initial result and one
more per **emission**, even when it contains several patches. A replay carries
the same index. `write.index` records the last index processed for the cache
document on that execution. Neither the server nor Forest Run supplies it.
Each new execution starts at zero. Long app uptime does not grow a global
counter, but a single never-ending execution can retain unbounded payload history.

## Why the history is still there

Separate `watchQuery` calls have separate `QueryInfo`s, even when they share the
network `Concast`. A late subscriber gets only its **last** emission. This is
different from two subscribers to one `ObservableQuery`.

- An existing writer already applied a patch: skip a duplicate delivery; do
  **not** replay old writes or rewrite the original list.
- Only `no-cache` observers saw the initial result and earlier patches: the
  cache has no original bindings. A late writer can use the stored initial
  result to register them and process the missed payloads, under its error
  policy, without a second request. A `no-cache` observer itself never writes.
- Observer delivery still needs assembled data, even when no cache write is
  allowed. Local resolvers can return a different result object per observer
  and finish asynchronously. Do not use post-resolver result identity, the
  patch path, or a mutable "latest index" to identify an emission.
- The network key uses the **server** document and variables. The write cursor
  uses the **full cache** document within that execution: different `@client`
  selections can share a server request. One watcher leaving must not release
  another's bindings. A cache reset invalidates old bindings.

`frame` is an Apollo-internal name for the execution, index and assembled data
for one delivery, not a server protocol type. `QueryInfo` keeps the catch-up
loop. Apollo checks only for `cache.writeIncrementalData`; an opted-in cache
implements both methods. `QueryInfo` calls `writeInitialData` with
`{ query, variables, token, data, pending, overwrite }` initially, then
`writeIncrementalData` with `{ query, variables, token, patches }` per accepted
emission. No frame, index or history
crosses the cache boundary. Forest Run uses its ordinary write machinery under
one transaction; `releaseIncremental` is not the capability check. Two
other designs considered, but not implemented, were sending entity-addressed
patches (a different server contract) and compiling deferred fragments into
follow-up queries (different requests rather than one incremental response).

## Alternative tried: request-owned token, no raw history

An isolated prototype kept a token per cache document on the shared request,
numbered emissions before local resolvers and kept an assembled snapshot for
delivery. A writer could join if it was current or the latest replay could fill
its only gap. Otherwise Apollo started a replacement request. Multiple late
writers could share that replacement. The prototype was **not** adopted.

The decisive case was a slow `@client` resolver: A received M1 and its patch
but hadn't written yet. B could not catch up, so its replacement request
returned M2 and wrote `[M2]`. Releasing A's resolver changed the cache back to
`[M1]`. Suppressing older writes after the replacement's first successful write
fixed identical client documents. It still failed when B merely aliased the
local field: the server queries were identical and both documents wrote
`messages`. The current branch kept one request in both cases.

| Measured variant | Apollo | Forest Run | Combined additions |
| --- | ---: | ---: | ---: |
| Kept implementation at `4cba95b6` | 122 | 184 | 306 |
| No history; restart on a gap | 102 | 184 | 286 |
| Also suppress older same-document writes | 116 | 184 | 300 |

These are **added lines**, not net lines: Apollo ESM and declarations versus
pristine 3.14.0, and Forest Run production source versus `origin/main` at the
time of the comparison. They exclude the CJS mirror, Supermassive, tests,
docs and the subsequent readability cleanup. Of 28 existing tests and five
prototype cases, the guarded version passed 31/33: the intentional extra
request and the different-client-document race were the two failures.

## Where to pick up

- **Porting Apollo:** the Yarn patch contains `core/QueryManager.js`,
  `core/QueryInfo.js`, `core/QueryInfo.d.ts`, `core/core.cjs` and declarations
  in `cache/core/cache.d.ts`, `cache/core/types/Cache.d.ts` and
  `link/core/types.d.ts`. Port the source behavior and regenerate both module
  formats in a fork. The dev dependency is scoped to Forest Run; an application
  needs the same patch or fork. Unmodified caches keep the stock path.
- **Regression suite:** [`incremental.test.ts`](./src/__tests__/incremental.test.ts)
  includes the reordered list, late writers with `network-only` and
  `cache-and-network`, a first writer after `no-cache`, multi-patch
  transactions, error policies, unsubscribe, refetch, eviction, reset, aliases
  and ID-less targets. From `packages/apollo-forest-run` with dependencies
  installed, use     the command below for a runtime-only run. All 29 cases passed on CJS and ESM,
  including the stock fallback for a cache without `writeIncrementalData`.
  The API split does not address the 13 existing Apollo-upgrade type errors.
- **Known gaps:** an ID-less patch can be dropped when its owner disappears
  from the original operation but remains in another. If a newly prepended
  row makes the cache diff incomplete, `watchQuery` can show the network list
  despite a correct cache write. Test cache contents and observer delivery
  separately. Nested targets introduced by patches, `@stream`, deferred
  mutations and routing a null patch payload are out of scope. A null field
  inside an object patch is different. Objects re-selected by a patch need
  their configured key fields; non-root keyed owners need `__typename`.
- **Local fields:** retain eager `@client` resolver values when assembling later
  results. Stock 3.14 resolves `remoteResult.data`, not `incremental[].data`;
  resolving local fields inside a deferred fragment is not implemented here.

```sh
node -e "const c = require('../../scripts/config/jest.config.js'); require('jest').run(['--config', JSON.stringify({ ...c, globals: { 'ts-jest': { diagnostics: false, isolatedModules: true } } }), '--runInBand', '--runTestsByPath', 'src/__tests__/incremental.test.ts'])"
```
