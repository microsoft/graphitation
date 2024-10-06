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
