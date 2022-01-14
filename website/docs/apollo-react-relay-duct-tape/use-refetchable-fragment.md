---
sidebar_position: 4
id: use-refetchable-fragment
title: useRefetchableFragment
description: API reference for useRefetchableFragment, a React hook used to refetch fragment data
keywords:
  - refetch
  - fragment
---

## `useRefetchableFragment`

You can use `useRefetchableFragment` when you want to fetch and re-render a fragment with different data:

```tsx
import React from "react";
import {
  graphql,
  useRefetchableFragment,
} from "@graphitation/apollo-react-relay-duct-tape";

import { CommentBodyRefetchQuery } from "./__generated__/CommentBodyRefetchQuery.graphql";
import { CommentBody_comment$key } from "./__generated__/CommentBody_comment.graphql";

interface Props {
  comment: CommentBody_comment$key;
}

const CommentBody: React.FC<Props> = (props) => {
  const [data, refetch] = useRefetchableFragment<CommentBodyRefetchQuery>(
    graphql`
      fragment CommentBody_comment on Comment
      @refetchable(queryName: "CommentBodyRefetchQuery") {
        body(lang: $lang) {
          text
        }
      }
    `,
    props.comment
  );

  return (
    <>
      <p>{data.body?.text}</p>
      <Button
        onClick={() => {
          refetch({ lang: "SPANISH" }, { fetchPolicy: "store-or-network" });
        }}
      >
        Translate Comment
      </Button>
    </>
  );
};

export default CommentBody;
```

### Arguments

- `fragment`: GraphQL fragment specified using a `graphql` template literal.
  - This fragment must have a `@refetchable` directive, otherwise using it will throw an error. The `@refetchable` directive can only be added to fragments that are "refetchable", that is, on fragments that are declared on the `Query` type, or on a type that implements `Node` (i.e. a type that has an `id`).
  - Note that you _do not_ need to manually specify a refetch query yourself. The `@refetchable` directive will autogenerate a query with the specified `queryName`. This will also generate TypeScript types for the query, available to import from the generated file: `<queryName>.graphql.ts`.
- `fragmentReference`: The _fragment reference_ is an opaque object that Apollo React/Relay Duct-Tape uses to read the data for the fragment from the store; more specifically, it contains information about which particular object instance the data should be read from.
  - The type of the fragment reference can be imported from the generated TypeScript types, from the file `<fragment_name>.graphql.ts`, and can be used to declare the type of your `Props`. The name of the fragment reference type will be: `<fragment_name>$key`.

### TypeScript Parameters

- `TQuery`: Type parameter that should corresponds the TypeScript type for the `@refetchable` query. This type is available to import from the the auto-generated file: `<queryName>.graphql.ts`.
- `TFragmentRef`: Type parameter corresponds to the type of the fragment reference argument (i.e. `<fragment_name>$key`). This type usually does not need to be explicitly specified, and can be omitted to let TypeScript infer the concrete type.

### Return Value

Tuple containing the following values

- [0] `data`: Object that contains data which has been read out from the store; the object matches the shape of specified fragment.
  - The TypeScript type for data will also match this shape, and contain types derived from the GraphQL Schema.
- [1] `refetch`: Function used to refetch the fragment with a potentially new set of variables.
  - Arguments:
    - `variables`: Object containing the new set of variable values to be used to fetch the `@refetchable` query.
      - These variables need to match GraphQL variables referenced inside the fragment.
      - However, only the variables that are intended to change for the refetch request need to be specified; any variables referenced by the fragment that are omitted from this input will fall back to using the value specified in the original parent query. So for example, to refetch the fragment with the exact same variables as it was originally fetched, you can call `refetch({})`.
      - Similarly, passing an `id` value for the `$id` variable is _*optional*_, unless the fragment wants to be refetched with a different `id`. When refetching a `@refetchable` fragment, Apollo React/Relay Duct-Tape will already know the id of the rendered object.
    - `options`: _*[Optional]*_ options object
      - `fetchPolicy`: Determines if cached data should be used, and when to send a network request based on cached data that is available. See the [Fetch Policies](../../guided-tour/reusing-cached-data/fetch-policies/) section for full specification.
      - `onComplete`: Function that will be called whenever the refetch request has completed, including any incremental data payloads.
  - Return value:
    - `disposable`: Object containing a `dispose` function. Calling `disposable.dispose()` will cancel the refetch request.
  - Behavior:
    - Calling `refetch` with a new set of variables will fetch the fragment again _with the newly provided variables_. Note that the variables you need to provide are only the ones referenced inside the fragment. In this example, it means fetching the translated body of the currently rendered Comment, by passing a new value to the `lang` variable.

### Behavior

- The component is automatically subscribed to updates to the fragment data: if the data for this particular `Comment` is updated anywhere in the app (e.g. via fetching new data, or mutating existing data), the component will automatically re-render with the latest updated data.
