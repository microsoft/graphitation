# Forest Run

**Experimental** custom cache for Apollo client using indexing and diffing for data syncing (instead of normalization).
Aims to be a drop-in replacement* for Apollo InMemoryCache.

# Motivation

Most GraphQL clients use "normalization" as a method to keep data in cache up-to date.
However, normalization is not a silver bullet and has associated costs:
performance overhead, necessity of garbage collection, consistency pitfalls due to partial nature of data in GraphQL
results, as well as increased overall complexity of GraphQL client cache
(read about [normalization pitfalls][1] to learn more).

Forest Run explores an alternative to "normalization" that doesn't require central normalized
store to keep data up to date. It aims to be a drop-in-replacement for Apollo InMemoryCache
(with some restrictions)

Expected benefits over InMemoryCache:

- Better performance (especially for cache reads)
- Improved memory usage (less garbage produced)
- Natural memory management (operations could be evicted when they are no longer watched)
- Improved observability and traceability (easy to track how an incoming operation affects cached operations)
- Ready for live-queries

# A different view on GraphQL client caches

We view GraphQL clients as basically emulations of ["live queries"][2] running locally.
Clients keep those "local live queries" up-to date by syncing with overlapping data from other incoming GraphQL operations
(mutations, subscriptions, other queries).

In this view of the world, normalized store is primarily an implementation detail of this "syncing" mechanism.
It is not a source of truth or data storage for local state. Or at least, caching is not a primary purpose
of GraphQL client.

# Architecture

## Experimental native incremental writes

`ForestRun.createIncrementalWriter({ query, variables })` creates a native
`@defer` execution. ForestRun owns fragment planning, original path/label routing,
out-of-order child-patch buffering, and target validity. No cache adapter or
external normalization callbacks are required.

Create one writer per network execution and deliver **unmerged** initial and
incremental payloads in transport order:

```ts
const writer = cache.createIncrementalWriter({ query, variables });
writer.write({ data: initialData, hasNext: true }, false);
writer.write({
  incremental: [
    { path: ["messages", 0], label: "details", data: { text: "ready" } },
  ],
  hasNext: false,
}, false);
writer.finish();
```

The query must declare the matching deferred fragment and label. The second
`write` argument is the initial-write `overwrite` policy; patches always merge.
`finish()` checks for unresolved patches and releases execution state; it is
idempotent and also runs on `hasNext: false`. Do not reuse a completed writer.
The client owns request sharing, delivery deduplication, cancellation, and network
result snapshots. Stock Apollo versions in this package's peer dependency range
do not call this API; an integrating client must hand payloads to it explicitly.
Ordinary cache writes remain unchanged.

Deferred targets come from the incoming indexed tree, including custom keys,
aliases, recycling, and repaired shared references. Targets are validated before
data publication. Their incarnation tokens become invalid on eviction, type
change, or removal of the last live cached occurrence, including through LRU.
Recreating an ID does not revive old tokens. Reset/restore invalidates pending
executions, whose subsequent writes are ignored.

Patches use the existing descriptor resolver and write pipeline in transient mode:
they update selected fields in existing trees without retaining separate patch
descriptors, trees, or extra roots. Field policies and transaction notifications
still apply. Writes join an existing base transaction or open a nonoptimistic
transaction for the whole payload. Creating or writing a native execution inside
an optimistic transaction throws.

For example, after a list changes from `[1, 2, 3, 4]` to `[1, 2, 3]`, a deferred
patch anchored to ID `4` cannot update ID `3` or reinsert `4`. It is dropped if no
live occurrence of `4` remains. If another cached query still contains `4`, only
that entity is updated; the removed list membership is not restored.

This prevents retargeting, **not stale field overwrites**. An accepted patch may
overwrite newer values of fields or links it explicitly selects. The caller must
deliver the legacy path/label-based query protocol; `@stream`, field-level
`@defer`, and unidentifiable deferred parents are rejected. Generated response
paths are not durable identity. Manually republishing an entire `no-cache` result bypasses these
protections. Ordinary ForestRun identity/key-field restrictions still apply.
Operation history, if enabled on existing queries, retains normal bounded history
of updates; incremental writes do not disable that feature.

Token state lives directly on the indexed forest, is allocated lazily for native
executions, and is cleared by reset. It keeps ID/type/token metadata, not response objects.
While targets are tracked, tree replacement and eviction also check their live
occurrences; applications with many overlapping cached queries should measure
this additional write-side work.

## Overview

Unlike normalized caches where data is stored in a single flat object and then propagated to "local live queries"
via cache reads, Forest Run preserves data in the original shape as it comes from GraphQL server, and attempts
to keep results _in sync_ for all "local live queries" on incoming writes.

All heavy lifting is happening where you naturally expect it: during _writes_.
Reads are `O(1)` lookups by a key (with a [few exceptions](#no-cross-query-reads)).

So how can data syncing work without normalization?

## GraphQL results syncing

In ForestRun data syncing is a 3-step process:

1. Indexing incoming operation result
2. Diffing individual nodes
3. Applying patches to existing "local live queries"

This separation into steps is a deliberate design decision allowing some further optimizations and features,
like building indexes on the server or [offloading](#offload-work-to-a-worker-thread)
both indexing and diffing to a worker thread.

In addition, it improves overall debuggability and traceability because it is possible to
capture history of every GraphQL result.

Let's briefly walk through every step individually.

### 1. Indexing operation result

Indexing is a process of remembering positions of individual nodes (objects having identity) inside operation result.

Imagine we are querying a post with a list of comments:

```graphql
query {
  post(id: "p1") {
    __typename
    id
    title
    comments {
      __typename
      id
      text
    }
  }
}
```

And receive the following data from the server:

```js
{
  post: {
    __typename: `Post`,
    id: `p1`,
    title: `My first post`,
    comments: [
      {
        __typename: "Comment",
        id: "c1",
        text: "hello"
      },
      {
        __typename: "Comment",
        id: "c2",
        text: "world"
      }
    ]
  }
}
```

Indexing algorithm produces a data structure, containing all the necessary information for comparing and updating
objects on incoming changes (note: this is only a high-level, conceptual overview):

```js
const index = {
  "Post:p1": [
    {
      data: {
        // the actual reference to the Post object from GraphQL result
      },
      selection: {
        // descriptor of Post fields (produced from GraphQL AST)
      },
      parent: "ROOT_QUERY", // reference to parent object within the operation
    },
  ],
  "Comment:c1": [
    {
      data: {
        /*...*/
      },
      selection: {
        // descriptor of Comment fields - the same instance for all comments
      },
      parent: "Post:p1",
    },
  ],
  "Comment:c2": [
    {
      data: {
        /*...*/
      },
      selection: {
        /*...*/
      },
      parent: "Post:p1",
    },
  ],
};
```

At a first glance it may seem similar to normalization, but there are several important differences:

1. Indexing doesn't have to loop through all keys of all objects (it only cares about individual objects, not fields).
1. Indexing doesn't normalize individual object "fields" with aliases and arguments (they are normalized once for document)
1. It also doesn't have to copy values of all object keys to the store object.
1. Index is created per-result, it is not global. So it can be disposed together with the result when it is no longer needed.

In addition to operation index, another compact index is created: `Map<NODE_ID, OPERATION_ID[]>` which lets us locate
all operations, containing a "chunk" of some node. Those two structures help us quickly locate all node "chunks" from
different operations.

Each composite object or list has a single parent location within an indexed result.
Manual writes and cross-operation recycling can introduce shared JavaScript references.
When indexing detects such sharing, a separate repair step copies repeated composite
occurrences and their affected ancestor paths, then reindexes the result. Caller-owned
data is not mutated, and unaffected branches retain their references. Results without
sharing do not require copying or a second indexing pass. This does not prohibit
separate objects with the same entity ID or reference sharing between different results.

### 2. Diffing individual entities

After indexing, we walk through all found ids and look for other "local live queries" that have this node in their
index. For ids that are already present in cache, diffing process is performed which produces a normalized difference
object with only changed fields.

This normalized difference is later used to update all cached operations containing node with this id.

Example. Imagine the author edits his comment `c1` (see [above](#1-indexing-operation-result)) and replaces text `hello`
with `hi`. So the following mutation is issued:

```graphql
mutation {
  editComment(id: "c1", text: "hi") {
    __typename
    id
    text
  }
}
```

And the incoming mutation result is:

```js
const data = {
  __typename: "Comment",
  id: "c1",
  text: "hi",
};
```

Now we need to sync the state of all our "local live queries" with this latest state.
After indexing this result, we see that it contains entity with id `Comment:c1`.
Next we find that the index of our original Post query also contains entity with the same id
`Comment:c1` (see [above](#1-indexing-operation-result)).

We can access entity object from both results quickly through respective indexes.
And so we `diff` this specific entity representation with the same entity `Comment:c1` stored in the original query
to get a normalized difference:

```js
const c1CommentDifference = {
  fields: {
    text: {
      oldValue: "hello",
      newValue: "hi",
    },
  },
  dirty: ["text"],
};
```

Normalized difference could be used to update multiple operations containing the same node to the latest state of the
world.

> Note: this is just a conceptual overview. Diffing is the most complex part of the implementation
> and has many nuances (embedded objects diffing, list diffing, abstract types diffing; missing fields,
> fields with errors, arguments, aliases, etc).

### 3. Updating cached operations

After diffing we get a normalized difference object for each incoming node. For every changed node we can find
affected operations and apply the difference.

Process of updating produces a single copy of the "dirty" operation result. Only changed objects and lists are copied.
Objects and lists that didn't change are recycled.

No unnecessary allocations, structured sharing is guaranteed.

## Aggregated Entity Views

In ForestRun, state of individual entity is spread across multiple GraphQL operation results.
There is no single centralized state as in the normalized store.
This may seem counter-intuitive, but it makes sense for the UI application, where true data consistency cannot be
guaranteed and the actual source of truth lives somewhere else.

Having said that, it is quite convenient to have a single view into entity's current state across all chunks.
This is achieved through aggregated entity views.

It is basically a short-living object that is created on demand (e.g. for diffing phase). This object is fed
with different chunks of the same entity found in different GraphQL results (via indexing) and so is a convenience tool
to represent single entity state from multiple chunks.


[1]: ./docs/normalization-pitfalls.md
[2]: https://medium.com/open-graphql/graphql-subscriptions-vs-live-queries-e38302c7ab8e
[3]: http://henrikeichenhardt.blogspot.com/2013/06/why-shared-mutable-state-is-root-of-all.html
