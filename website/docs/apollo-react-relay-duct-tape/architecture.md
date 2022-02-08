---
sidebar_position: 1
---

# Architecture

## Query as the unit of store observation

### How it works

In traditional Apollo Client usage, one creates a GraphQL [`query` operation document](https://spec.graphql.org/June2018/#sec-Language.Operations), either as a single document or assembled from [`fragment` documents](https://spec.graphql.org/June2018/#sec-Language.Fragments), and then executes that as a single unit using e.g. [Apollo Client’s `useQuery` hook](https://www.apollographql.com/docs/react/data/queries/#usequery-api).

How it was assembled does not matter to a [GraphQL executor](https://spec.graphql.org/June2018/#sec-Execution) nor Apollo Client, it is treated as a single request/response. When the response data is received, Apollo Client [normalizes the nested payload into its data-store](https://www.apollographql.com/blog/apollo-client/caching/demystifying-cache-normalization/) ([Apollo Cache](https://www.apollographql.com/docs/react/caching/overview/)) and yields the data to the caller of `useQuery`.

On top of this, Apollo Client layers a feature called [”observable query”](https://www.apollographql.com/docs/react/api/core/ObservableQuery/), which is implicitly created by `useQuery` using [the `watchQuery` API](https://www.apollographql.com/docs/react/api/core/ApolloClient/#ApolloClient.watchQuery). From its documentation:

> This watches the cache store of the query […] and returns an ObservableQuery. We can subscribe to this ObservableQuery and receive updated results through a GraphQL observer when the cache store changes.

### Problem statement

## Fragment as the unit of store observation

### useFragment

### useLazyLoadQuery

### useRefetchableFragment

### usePaginationFragment
