---
sidebar_position: 2
id: use-lazy-load-query
title: useLazyLoadQuery
description: API reference for useLazyLoadQuery, a React hook used to lazily fetch query data when a component renders
keywords:
  - lazy fetching
  - query
  - fetch
---

## `useLazyLoadQuery`

Hook used to fetch a GraphQL query during render. This hook can trigger multiple nested or waterfalling round trips if used without caution, and waits until render to start a data fetch.

```tsx
import React from "react";
import {
  graphql,
  useLazyLoadQuery,
} from "@graphitation/apollo-react-relay-duct-tape";

import { AppQuery } from "./__generated__/AppQuery.graphql";

const App: React.FC = {
  const { data, error } = useLazyLoadQuery<AppQuery>(
    graphql`
      query AppQuery($id: ID!) {
        user(id: $id) {
          name
        }
      }
    `,
    { id: 4 },
    { fetchPolicy: "store-or-network" }
  );

  if (error) {
    return <div>{error.message}</div>;
  } else if (data) {
    return <div>{data.user?.name} is great!</div>;
  }
  return <div>Loading</div>;
}
```

### Arguments

- `query`: GraphQL query specified using a `graphql` template literal.
- `variables`: Object containing the variable values to fetch the query. These variables need to match GraphQL variables declared inside the query.
- `options`: _*[Optional]*_ options object
  - `fetchPolicy`: Determines if cached data should be used, and when to send a network request based on the cached data that is currently available in the store (for more details, see our [Fetch Policies](../../guided-tour/reusing-cached-data/fetch-policies):
    - "store-or-network": _*(default)*_ _will_ reuse locally cached data and will _only_ send a network request if any data for the query is missing. If the query is fully cached, a network request will _not_ be made.
    - "store-and-network": _will_ reuse locally cached data and will _always_ send a network request, regardless of whether any data was missing from the local cache or not.
    - "network-only": _will_ _not_ reuse locally cached data, and will _always_ send a network request to fetch the query, ignoring any data that might be locally cached.
    - "store-only": _will_ _only_ reuse locally cached data, and will _never_ send a network request to fetch the query. In this case, the responsibility of fetching the query falls to the caller, but this policy could also be used to read and operate on data that is entirely [local](../../guided-tour/updating-data/local-data-updates).

### TypeScript Parameters

- `TQuery`: Type parameter that should correspond to the TypeScript type for the specified query. This type is available to import from the auto-generated file: `<query_name>.graphql.ts`.

### Return Value

Object containing the following properties:

- `data`: Object that contains data which has been read out from the store; the object matches the shape of the specified query.
  - The TypeScript type for data will also match this shape, and contain types derived from the GraphQL Schema. For example, the type of `data` above is: `{ user: { name: string } }`.

### Behavior

- It is expected for `useLazyLoadQuery` to have been rendered under a [`ApolloProvider`](https://www.apollographql.com/docs/react/api/react/hooks/#the-apolloprovider-component), in order to access the correct Apollo Client environment, otherwise an error will be thrown.
- The component is automatically subscribed to updates to the query data: if the data for this query is updated anywhere in the app, the component will automatically re-render with the latest updated data.
- After a component using `useLazyLoadQuery` has committed, re-rendering/updating the component will not cause the query to be fetched again.
  - If the component is re-rendered with _different query variables,_ that will cause the query to be fetched again with the new variables, and potentially re-render with different data.
  - If the component _unmounts and remounts_, that will cause the current query and variables to be refetched (depending on the `fetchPolicy` and the state of the store).
