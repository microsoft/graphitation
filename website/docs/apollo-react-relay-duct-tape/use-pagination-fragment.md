---
sidebar_position: 5
id: use-pagination-fragment
title: usePaginationFragment
description: API reference for usePaginationFragment, a React hook used to paginate a connection
keywords:
  - pagination
  - connection
---

## `usePaginationFragment`

You can use `usePaginationFragment` to render a fragment that uses a `@connection` and paginate over it:

```tsx
import React from "react";
import {
  graphql,
  usePaginationFragment,
} from "@graphitation/apollo-react-relay-duct-tape";

import { FriendsListPaginationQuery } from "./__generated__/FriendsListPaginationQuery.graphql";
import { FriendsList_user$key } from "./__generated__/FriendsList_user.graphql";

interface Props {
  user: FriendsList_user$key;
}

const FriendsList: React.FC<Props> = (props) => {
  const {
    data,
    loadNext,
    loadPrevious,
    hasNext,
    hasPrevious,
    isLoadingNext,
    isLoadingPrevious,
    refetch, // For refetching connection
  } = usePaginationFragment<FriendsListPaginationQuery>(
    graphql`
      fragment FriendsListComponent_user on User
      @refetchable(queryName: "FriendsListPaginationQuery") {
        name
        friends(first: $count, after: $cursor)
          @connection(key: "FriendsList_user_friends") {
          edges {
            node {
              name
              bio(lang: $lang)
            }
          }
        }
      }
    `,
    props.user
  );

  return (
    <>
      <h1>Friends of {data.name}:</h1>

      <List items={data.friends?.edges.map((edge) => edge.node)}>
        {(node) => {
          return (
            <div>
              {node.name} - {node.bio}
            </div>
          );
        }}
      </List>
      <Button onClick={() => loadNext(10)}>Load more friends</Button>
    </>
  );
};

export default FriendsList;
```

### Arguments

- `fragment`: GraphQL fragment specified using a `graphql` template literal.
  - This fragment must have an `@connection` directive on a connection field, otherwise using it will throw an error.
  - This fragment must have a `@refetchable` directive, otherwise using it will throw an error. The `@refetchable` directive can only be added to fragments that are "refetchable", that is, on fragments that are declared on `Viewer` or `Query` types, or on a type that implements `Node` (i.e. a type that has an `id`).
    - Note that you _do not_ need to manually specify a pagination query yourself. The `@refetchable` directive will autogenerate a query with the specified `queryName`. This will also generate TypeScript types for the query, available to import from the generated file: `<queryName>.graphql.ts`.
- `fragmentReference`: The _fragment reference_ is an opaque object that Apollo React/Relay Duct-Tape uses to read the data for the fragment from the store; more specifically, it contains information about which particular object instance the data should be read from.
  - The type of the fragment reference can be imported from the generated TypeScript types, from the file `<fragment_name>.graphql.ts`, and can be used to declare the type of your `Props`. The name of the fragment reference type will be: `<fragment_name>$key`.

### TypeScript Type Parameters

- `TQuery`: Type parameter that should corresponds the TypeScript type for the `@refetchable` pagination query. This type is available to import from the the auto-generated file: `<queryName>.graphql.ts`.
- `TFragmentRef`: Type parameter corresponds to the type of the fragment reference argument (i.e. `<fragment_name>$key`). This type usually does not need to be explicitly specified, and can be omitted to let TypeScript infer the concrete type.

### Return Value

Object containing the following properties:

- `data`: Object that contains data which has been read out from the store; the object matches the shape of specified fragment.
  - The TypeScript type for data will also match this shape, and contain types derived from the GraphQL Schema.
- `isLoadingNext`: Boolean value which indicates if a pagination request for the _next_ items in the connection is currently in flight, including any incremental data payloads.
- `isLoadingPrevious`: Boolean value which indicates if a pagination request for the _previous_ items in the connection is currently in flight, including any incremental data payloads.
- `hasNext`: Boolean value which indicates if the end of the connection has been reached in the "forward" direction. It will be true if there are more items to query for available in that direction, or false otherwise.
- `hasPrevious`: Boolean value which indicates if the end of the connection has been reached in the "backward" direction. It will be true if there are more items to query for available in that direction, or false otherwise.
- `loadNext`: Function used to fetch more items in the connection in the "forward" direction.
  - Arguments:
    - `count`_:_ Number that indicates how many items to query for in the pagination request.
    - `options`: _*[Optional]*_ options object
      - `onComplete`: Function that will be called whenever the refetch request has completed, including any incremental data payloads. If an error occurs during the request, `onComplete` will be called with an `Error` object as the first parameter.
  - Return Value:
    - `disposable`: Object containing a `dispose` function. Calling `disposable.dispose()` will cancel the pagination request.
  - Behavior:
    - The `isLoadingNext` value will be set to true while the request is in flight, and the new items from the pagination request will be added to the connection, causing the component to re-render.
    - Pagination requests initiated from calling `loadNext` will _always_ use the same variables that were originally used to fetch the connection, _except_ pagination variables (which need to change in order to perform pagination); changing variables other than the pagination variables during pagination doesn't make sense, since that'd mean we'd be querying for a different connection.
- `loadPrevious`: Function used to fetch more items in the connection in the "backward" direction.
  - Arguments:
    - `count`_:_ Number that indicates how many items to query for in the pagination request.
    - `options`: _*[Optional]*_ options object
      - `onComplete`: Function that will be called whenever the refetch request has completed, including any incremental data payloads. If an error occurs during the request, `onComplete` will be called with an `Error` object as the first parameter.
  - Return Value:
    - `disposable`: Object containing a `dispose` function. Calling `disposable.dispose()` will cancel the pagination request.
  - Behavior:
    - The `isLoadingPrevious` value will be set to true while the request is in flight, and the new items from the pagination request will be added to the connection, causing the component to re-render.
    - Pagination requests initiated from calling `loadPrevious` will _always_ use the same variables that were originally used to fetch the connection, _except_ pagination variables (which need to change in order to perform pagination); changing variables other than the pagination variables during pagination doesn't make sense, since that'd mean we'd be querying for a different connection.
- `refetch`: Function used to refetch the connection fragment with a potentially new set of variables.
  - Arguments:
    - `variables`: Object containing the new set of variable values to be used to fetch the `@refetchable` query.
      - These variables need to match GraphQL variables referenced inside the fragment.
      - However, only the variables that are intended to change for the refetch request need to be specified; any variables referenced by the fragment that are omitted from this input will fall back to using the value specified in the original parent query. So for example, to refetch the fragment with the exact same variables as it was originally fetched, you can call `refetch({})`.
      - Similarly, passing an `id` value for the `$id` variable is _*optional*_, unless the fragment wants to be refetched with a different `id`. When refetching a `@refetchable` fragment, Relay will already know the id of the rendered object.
    - `options`: _*[Optional]*_ options object
      - `fetchPolicy`: Determines if cached data should be used, and when to send a network request based on cached data that is available. See the [Fetch Policies](../../guided-tour/reusing-cached-data/fetch-policies/) section for full specification.
      - `onComplete`: Function that will be called whenever the refetch request has completed, including any incremental data payloads.
  - Return value:
    - `disposable`: Object containing a `dispose` function. Calling `disposable.dispose()` will cancel the refetch request.
  - Behavior:
    - Calling `refetch` with a new set of variables will fetch the fragment again _with the newly provided variables_. Note that the variables you need to provide are only the ones referenced inside the fragment. In this example, it means fetching the translated `bio` of the friends, by passing a new value to the `lang` variable.

### Behavior

- The component is automatically subscribed to updates to the fragment data: if the data for this particular `User` is updated anywhere in the app (e.g. via fetching new data, or mutating existing data), the component will automatically re-render with the latest updated data.
