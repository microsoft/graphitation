# Pitfalls of normalized caches in GraphQL clients

> Also read [this normalization analysis][13] from authors of Apollo Hermes cache

<!-- TOC -->
  * [What is normalization?](#what-is-normalization)
  * [Benefits of normalization](#benefits-of-normalization)
  * [Performance costs of normalization](#performance-costs-of-normalization)
  * [Memory costs](#memory-costs)
  * [Garbage collection costs](#garbage-collection-costs)
  * [Consistency surprises](#consistency-surprises)
    * [Example 1. Missing fields](#example-1-missing-fields)
    * [Example 2. Missing fields for non-normalized objects](#example-2-missing-fields-for-non-normalized-objects)
    * [Example 3. Derived fields](#example-3-derived-fields)
    * [Example 4. Manual store updates necessary](#example-4-manual-store-updates-necessary)
    * [Example 5. Non-deterministic behavior](#example-5-non-deterministic-behavior)
  * [Conclusion](#conclusion)
  * [Directions to explore](#directions-to-explore)
    * [1. Pre-normalized GraphQL results](#1-pre-normalized-graphql-results)
    * [2. Denormalized, document cache](#2-denormalized-document-cache)
    * [3. Graph cache](#3-graph-cache)
<!-- TOC -->

## What is normalization?

Advanced GraphQL clients have introduced a so called "normalized" caches. [Apollo][3], [Relay][4], [URQL][5] - all of them
have their own implementation of this concept which is inspired by [database normalization][1].

So what does normalization mean in the context of GraphQL clients? Imagine our client sends a GraphQL query that fetches
a post with a list of comments:

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

And receives the following data from the server:

```js
// Step 1
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

Before storing this data the client has to go through all the results recursively and transform them to a flat
_normalized_ structure. Different clients use slightly different structures but the idea is the same.
For example Apollo will transform the result to this object:

```js
// Step 2
const data = {
  "Post:p1": {
    __typename: `Post`,
    id: `p1`,
    title: `My first post`,
    comments: [{ __ref: "Comment:1" }, { __ref: "Comment:2" }],
  },
  "Comment:c1": {
    __typename: `Comment`,
    id: "c1",
    text: "hello",
  },
  "Comment:c2": {
    __typename: `Comment`,
    id: "c2",
    text: "world",
  },
  ROOT_QUERY: {
    'post({"id":"p1"})': { __ref: "Post:p1" },
  },
};
```

After normalizing the result, GraphQL clients will merge this structure into a single object that acts as a
shared data store.
All subsequent queries, subscriptions and mutation results will be also written to the same normalized store.

For example, if we send a mutation:

```graphql
mutation {
  editComment(id: "c1", text: "hi") {
    __typename
    id
    text
  }
}
```

The result will be merged into the store (under `Comment:c1` key), and so on next read from the cache,
our original query will return the updated result without going to the network:

```diff
// Step 3
{
  post: {
    __typename: `Post`,
    id: `p1`,
    title: `My first post`,
    comments: [
      {
        __typename: "Comment",
        id: "c1",
-        text: "hello"
+        text: "hi"
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

This process is inverse to normalization: clients are restoring the original shape of query data
with all the updates that came from different sources (mutations, subscriptions, other queries, etc).

**Lets re-cap**... Any incoming GraphQL operation goes through several steps:

1. Normalizing incoming data
2. Merging normalized incoming data into shared `store` object
3. Reading data from the `store` to return it back to requester in the shape of the original GraphQL result

But there is more... Clients also keep track of "active" queries and whenever data in the store changes,
they essentially re-read those active queries, using the data from the store and notify any query observers 
about the change. Granularity of re-reading (i.e. at the query level vs the fragment level) has different [performance implications][15])

Read more:

- An excellent [article from URQL team][5] about normalization
- Another article from [Relay team][4].

## Benefits of normalization

_In theory_, normalization makes it easier to keep data in the cache consistent.
The data is stored in a single shared object (using `id` and `__typename` of individual objects as a key),
so it is always up-to-date with the server results.

Also, _in theory_, normalized caches allow you to reduce the number of network requests:
if the data requested by your query was already fetched by another query,
the client can just retrieve it from the cache and bypass the network request.

However, note that _even if you cannot avoid a network request_, a normalized cache that integrates
with suspense (such as Relay's) makes it very trivial to achieve the following behavior:
when a user navigates from a list view to a detail view, the transition can occur instantaneously,
and the components for which there is enough data (such as the detail view header) can render
instantly. The rest of the detail view is replaced by a suspense boundary.

However, normalization in GraphQL clients comes at a cost, and also has surprising pitfalls that we will cover below.

## Performance costs of normalization

GraphQL query results are inherently _de-normalized_ (may contain duplicates and derived data), _partial_, and
_hierarchical_ (query result represents a slice of the graph as a tree).

In practice, it means that significant work has to happen on the client to transform incoming data
from GraphQL result to normalized shape. Furthermore, _reading_ from the store is also not a cheap operation
because you need to go through the normalized store again to restore the original shape of data.

And don't forget that a single `write` may lead to several `reads` (for actively watched queries).

Clients do sophisticated optimizations at different levels to avoid unnecessary transformations during reads by introducing
even more caching, and even more complexity (e.g. result cache for reads in Apollo, read snapshots in Relay).

> See [this benchmark][7] exploring normalization overhead of just `write` operations (without following reads)

> Another [benchmark](https://github.com/Andycko/graphql-client-benchmarks) gives some picture of `read` overhead for
> different clients (see fully cached reads)

## Memory costs

Additional allocated object per each source object with `id`.
Overhead associated with references to other objects (varies from client to client).

## Garbage collection costs

Normalization inevitably raises the question of garbage collection. When do you remove items from the normalized store object?
It is not a trivial question because the same item may be used by multiple active queries/components. Or on the other hand
when those queries are no longer observed - unneeded items still remain in the store.

Clients have to introduce significant complexity to tackle this problem.
Relay and URQL do it automatically via reference counting by tracking how many active queries are using every item in cache.
Apollo exposes an API for manual cache eviction and garbage collection, so it kindly invites you to introduce this complexity in your own code.

Cleaning up garbage is also expensive performance-wise and may noticeably block event loop,
so it requires some scheduling (which means even more complexity).

> Note: We are not talking about JS garbage collection. It is basically another custom GC on top of JS GC.

## Consistency surprises

One of the main promises of normalization is to make it easier to keep data in the cache consistent.
Unfortunately this promise becomes moot when the source data is partial and inherently denormalized
(like GraphQL query results in general).

Let's walk through several examples.

### Example 1. Missing fields

Imagine an app with a component that renders a list of blog posts:

```graphql
query PostsWithTitle {
  posts {
    id
    title
  }
}
```

Let's assume it returns a list with a single post:

```js
[{ id: "1", title: "Foo" }];
```

After a while, user navigates to another screen where the following query is executed:

```graphql
query PostsWithAuthor {
  posts {
    id
    author
  }
}
```

In between some new post was created, and now the result contains two posts:

```js
[
  { id: "1", author: "Jane" },
  { id: "2", author: "John" },
];
```

After merging into the store, the store contains:

```json
{
  "Post:1": { "id": "1", "author": "Jane", "title": "Foo" },
  "Post:2": { "id": "2", "author": "John" }
}
```

What happens if we try to read the first query `PostsWithTitle` from the store?
This query requests a `title` but the second item in the store has no `title` because it was fetched through a different query.

So the client cannot return even a stale result from the store for the `PostsWithTitle` query.

Clients handle this problem differently, but in general there is some other layer that holds data
from previous reads, that could be used while the query is being re-fetched from network.

As we see, "normalized" store itself becomes inconsistent due to partial nature of data coming via GraphQL results.

### Example 2. Missing fields for non-normalized objects

> Note: this example is likely specific to Apollo implementation

This problem is similar to the previous example, but doesn't even require arrays.
If result contains non-normalized objects (objects without `id`), Apollo embeds them in its parent "entity".

Look at the following queries. The first query contains `name` field for the category and the second contains `description`
field. How it will be normalized?

```graphql
query PostsWithCategoryName {
  post(id: "1") {
    id
    category {
      name
    }
  }
}
query PostsWithCategoryDescription {
  post(id: "1") {
    id
    category {
      description
    }
  }
}
```

After the first query is processed, the store contains:

```json
{
  "Post:1": { "id": "1", "category": { "name": "Foo" } }
}
```

After the second query, category has no `name` anymore:

```json
{
  "Post:1": { "id": "1", "category": { "description": "FooDescription" } }
}
```

So if we try to re-read the first query from the store - it will fail because the first query must return `name`
which is no longer available.

This is a default behavior of Apollo that could be [customized][10] with some performance cost.
Relay and URQL generate ids for such denormalized objects and do store them in this flat normalized structure
(although it breaks the concept of normalization, since this is dependent data).

### Example 3. Derived fields

```graphql
{
  user(id: "1") {
    id
    firstName
    displayName # in the schema composed of firstName, lastName
  }
}
```

Returns:

```json
{ "id": "1", "firstName": "John", "displayName": "John Doe" }
```

Now the name has changed on the server and another query is issued:

```graphql
{
  user(id: "1") {
    id
    firstName
  }
}
```

Returns:

```json
{ "id": "1", "firstName": "Jane" }
```

And the store contains:

```json
{
  "User:1": { "id": "1", "firstName": "Jane", "displayName": "John Doe" }
}
```

Re-running the first query will lead to inconsistent data in the result. This is inevitable in this world of partial
data updates.

### Example 4. Manual store updates necessary

GraphQL queries are expected to be [idempotent][11]. But mutations and subscriptions are not necessarily idempotent.
Depending on specific case GraphQL schema authors may decide to keep them non-idempotent.

In this case GraphQL client won't be able to automatically keep the store in consistent state.
It requires manual updates.

Let's look at [our first example](#what-is-normalization) again. The query returns a post with a list of comments:

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

Now let's run a mutation that adds a new comment:

```graphql
mutation {
  addComment(postId: "p1", text: "hi!") {
    __typename
    id
    text
  }
}
```

After execution, the store will look like this:

```js
// Step 2
const data = {
  "Post:p1": {
    // ... original fields
    comments: [{ __ref: "Comment:1" }, { __ref: "Comment:2" }],
  },
  // "Comment:c1": ...
  // "Comment:c2": ...
  "Comment:c3": {
    __typename: `Comment`,
    id: "c3",
    text: "hi!",
  },
  ROOT_QUERY: {
    'post({"id":"p1"})': { __ref: "Post:p1" },
  },
};
```

We see that the comment is added to the root-level of the store. But the `comments` field of the original post
still contains only two comments and our new comment was not added there.

All clients depend on "manual" store updates to ensure consistency in such cases.

> There are other more sophisticated examples with `null` values caused by error bubbling, stateful or context-dependent
> results, etc.

### Example 5. Non-deterministic behavior

Queries are independent, but store is global. Some configuration of writes may lead to consistent state,
another configuration of writes may lead to inconsistent state
(and either cause unexpected network requests or fail depending on fetchPolicy).

Imagine two independent queries that arrive sequentially:

```graphql
query A { node(id: "2") { __typename, id, foo } }
query B { list { __typename, id, foo } }
```

And the corresponding results are:

```ts
const A = {
  node: { __typename: "Foo", id: "2", foo: "2" }
}
const B = {
  list: [ {  __typename: "Foo", id: "1", foo: "1" } ]
}
```

The important piece here is that field `foo` for nodes `1` and `2` is fetched by different independent queries.

Now imagine node `2` was added to the list by someone. And then, the 3rd independent query `C` gets executed:

```graphql
query C { list { __typename, id } }
```

With this result:

```ts
const C = {
  list: [
    {  __typename: "Foo", id: "1" },
    {  __typename: "Foo", id: "2" }
  ]
}
```

The list has 2 items, but only with `id` field, there is no `foo` field. What happens now with the query `B`
that needs to return the `foo` field?

The result of `B` is correctly updated from cache, thanks to shared store:
```ts
const B = {
  list: [
    { __typename: "Foo", id: "1", foo: "1" },
    { __typename: "Foo", id: "2", foo: "2" },
  ]
}
```

Sounds good, right? We've avoided unnecessary network request, things are fast.
The problem though that it works "by accident".

Now some change occurs in a seemingly unrelated part of the application and query `A` is no longer requested.
All of a sudden, query `B` now needs a network request or fails! Because now it cannot be satisfied from cache:

```ts
const B = {
  list: [
    { __typename: "Foo", id: "1", foo: "1" }
  ]
}
const C = {
  list: [
    { __typename: "Foo", id: "1" },
    { __typename: "Foo", id: "2" }
  ]
}
```

This is another surprising effect of having a global normalized store: you are basically introducing
implicit dependencies between completely different parts of your application.

Things may get much worse, if you also write to cache manually from different places.
In this case, normalized store literally becomes a [shared mutable state][6].


## Conclusion

As we can see, normalization by itself doesn't guarantee strong consistency when the source data is incomplete and derived.
And sometimes may even introduce surprising quirks in behavior because a single normalized store acts as [shared mutable state][6].

The main takeaway is that "stale" data is inevitable in GraphQL clients. Only a subset of scenarios leads to consistent
data state in normalized store.
Normalization is not a silver bullet - it cannot guarantee automatic data consistency when the source data is partial, derived and inherently denormalized.

In addition, it adds a noticeable performance overhead not only to writes, but also to _reads_;
requires garbage collection and significantly contributes to the overall complexity of major GraphQL clients.

But is this complexity inherent or accidental? It requires more research and experimentation.

## Directions to explore

There are essentially several directions to explore that may improve current state of the art in GraphQL client caches.

### 1. Pre-normalized GraphQL results

This approach is just an optimization for normalized caches.
It can provide some performance improvements for `write` operations ([a benchmark][7]) but
no improvements for `reads`, garbage collection or system complexity.
It also doesn't solve any quirks of [shared mutable state][6].

As a downside, it requires non-standard GraphQL response and may break integrations with existing tools.

> Interestingly enough, Relay team seem to have been already running such experiments (codename [GraphMode][8]).

This direction can be expanded by transforming GraphQL execution into two independent processes:

- Incremental, partial replication protocol for local normalized store (maybe reactive)
- Local GraphQL execution against this normalized store

### 2. Denormalized, document cache

It is worth exploring an alternative design of a GraphQL client cache where watched query results are stored separately
and are kept in sync on write without intermediate normalized store.

Somewhat an advanced version of [URQL document cache][12] (which is too simplistic and doesn't even attempt to
keep results in sync).

Potential benefits:

- Much simpler architecture with way less data transformations.
- Natural garbage collection (dispose the whole query and all associated metadata when not needed)
- `O(1)` `read` complexity (simply returns the object that is already up-to-date). Memoization works out of the box,
  and no need for subscriptions.
- `write` performance comparable to `normalization` due to the need of synchronization of different results
  (although much better for initial writes and writes that do not affect other results)
- Stale data still available when consistency cannot be achieved by syncing with other operations

Limitations:

- No cross-query data reads. `read` only allowed for queries that were written previously (+reads for subsets of queries).
  - Relatedly, no cross-query consistency, meaning that if a user modifies data on a given page and navigates back to a previous
    page, the data on the previous page will be inconsistent. Adds a burden on developers to invalidate in response to mutations.
- Potentially higher memory consumption as strings are not de-duplicated from source JSON
  (could be mitigated with background compaction, also less important with natural GC)
- One cannot obviously get [data masking][14]
  without introducing a step in which data is read from a source, so the simplicity gains may not be as drastic as assumed.
- Inability to reuse data, meaning that transitions from list views to detailed views cannot be perceptually instant.

### 3. Graph cache

The first attempt was made in [Apollo Hermes][9]. It makes `read` a basically `O(1)` operation, however
Garbage Collection is very hard in this model, result returned by client is not spec-compliant
(returns more data than requested), support for abstract types is also limited.

And complexity is even higher than in existing cache implementations.

> TODO: figure out why Hermes is dead?

[1]: https://en.wikipedia.org/wiki/Database_normalization
[2]: https://en.wikipedia.org/wiki/Object%E2%80%93relational_impedance_mismatch
[3]: https://www.apollographql.com/docs/react/caching/overview/#data-normalization
[4]: https://relay.dev/docs/principles-and-architecture/thinking-in-graphql/#caching-a-graph
[5]: https://formidable.com/open-source/urql/docs/graphcache/normalized-caching/
[6]: http://henrikeichenhardt.blogspot.com/2013/06/why-shared-mutable-state-is-root-of-all.html
[7]: https://github.com/vladar/graphql-normalized
[8]: https://github.com/facebook/relay/blob/45a3afbe4e6424e6b4626f5682d99c08bb267fc3/packages/relay-runtime/store/RelayExperimentalGraphResponseTransform.js#L44-L47
[9]: https://github.com/convoyinc/apollo-cache-hermes
[10]: https://www.apollographql.com/docs/react/caching/cache-field-behavior#merging-non-normalized-objects
[11]: https://en.wikipedia.org/wiki/Idempotence
[12]: https://formidable.com/open-source/urql/docs/basics/document-caching/
[13]: https://github.com/convoyinc/apollo-cache-hermes/blob/master/docs/Motivation.md
[14]: https://relay.dev/docs/principles-and-architecture/thinking-in-relay/#data-masking
[15]: https://quoraengineering.quora.com/Choosing-Quora-s-GraphQL-client
