---
sidebar_position: 3
id: use-fragment
title: useFragment
description: API reference for useFragment, a React hook used to read fragment data from the Relay store using a fragment reference
keywords:
  - fragment
  - read
  - fragment reference
---

## `useFragment`

```tsx
import React from "react";
import {
  graphql,
  useFragment,
} from "@graphitation/apollo-react-relay-duct-tape";

import { UserComponent_user$key } from "./__generated__/UserComponent_user.graphql";

interface Props {
  user: UserComponent_user$key;
}

const UserComponent: React.FC<Props> = (props) => {
  const data = useFragment(
    graphql`
      fragment UserComponent_user on User {
        name
        profile_picture(scale: 2) {
          uri
        }
      }
    `,
    props.user
  );

  return (
    <>
      <h1>{data.name}</h1>
      <div>
        <img src={data.profile_picture?.uri} />
      </div>
    </>
  );
};

export default UserComponent;
```

### Arguments

- `fragment`: GraphQL fragment specified using a `graphql` template literal.
- `fragmentReference`: The _fragment reference_ is an opaque object that Apollo React/Relay Duct-Tape uses to read the data for the fragment from the store; more specifically, it contains information about which particular object instance the data should be read from.
  - The type of the fragment reference can be imported from the generated TypeScript types, from the file `<fragment_name>.graphql.ts`, and can be used to declare the type of your `Props`. The name of the fragment reference type will be: `<fragment_name>$key`.

### Return Value

- `data`: Object that contains data which has been read out from the store; the object matches the shape of specified fragment.
  - The TypeScript type for data will also match this shape, and contain types derived from the GraphQL Schema. For example, the type of `data` above is: `{ name: string, profile_picture: null | { uri: string } }`.

### Behavior

- The component is automatically subscribed to updates to the fragment data: if the data for this particular `User` is updated anywhere in the app (e.g. via fetching new data, or mutating existing data), the component will automatically re-render with the latest updated data.
