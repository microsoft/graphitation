---
sidebar_position: 7
id: use-subscription
title: useSubscription
description: API reference for useSubscription, a React hook used to subscribe and unsubscribe from a subscription
keywords:
  - subscription
---

⚠️ _NOTE: This document still needs to be updated for Apollo React/Relay Duct-Tape._

## `useSubscription`

Hook used to subscribe and unsubscribe to a subscription.

```js
import {graphql, useSubscription} from 'react-relay';
import {useMemo} from 'react';

const subscription = graphql`
  subscription UserDataSubscription($input: InputData!) {
    # ...
  }
`;

function UserComponent({ id }) {
  // IMPORTANT: your config should be memoized.
  // Otherwise, useSubscription will re-render too frequently.
  const config = useMemo(() => ({
    variables: {id},
    subscription,
  }), [id, subscription]);

  useSubscription(config);

  return (/* ... */);
}
```

### Arguments

- `config`: a config of type [`GraphQLSubscriptionConfig`](#type-graphqlsubscriptionconfigtsubscriptionpayload) passed to [`requestSubscription`](../request-subscription/)
- `requestSubscriptionFn`: `?<TSubscriptionPayload>(IEnvironment, GraphQLSubscriptionConfig<TSubscriptionPayload>) => Disposable`. An optional function with the same signature as [`requestSubscription`](../request-subscription/), which will be called in its stead. Defaults to `requestSubscription`.

#### Type `GraphQLSubscriptionConfig<TSubscriptionPayload>`

- An object with the following fields:
  - `cacheConfig`: _*[Optional]*_ [`CacheConfig`](#type-cacheconfig)
  - `subscription`: `GraphQLTaggedNode`. A GraphQL subscription specified using a `graphql` template literal
  - `variables`: The variables to pass to the subscription
  - `onCompleted`: _*[Optional]*_ `() => void`. An optional callback that is executed when the subscription is established
  - `onError`: _*[Optional]*_ `(Error) => {}`. An optional callback that is executed when an error occurs
  - `onNext`: _*[Optional]*_ `(TSubscriptionPayload) => {}`. An optional callback that is executed when new data is received
  - `updater`: _*[Optional]*_ [`SelectorStoreUpdater`](#type-selectorstoreupdater).

### Flow Type Parameters

- `TSubscriptionPayload`: The type of the payloads vended by the subscription. You should pass the flow type imported from the auto-generated `.graphql` file corresponding to the subscription, e.g. use `UserDataSubscription` as the type parameter, from `import type {UserDataSubscription} from './__generated__/UserDataSubscription.graphql'`;

### Behavior

- This is only a thin wrapper around the `requestSubscription` API. It will:
  - Subscribe when the component is mounted with the given config
  - Unsubscribe when the component is unmounted
  - Unsubscribe and resubscribe with new values if the environment, config or `requestSubscriptionFn` changes.
- If you have the need to do something more complicated, such as imperatively requesting a subscription, please use the [`requestSubscription`](../request-subscription/) API directly.
- See the [GraphQL Subscriptions Guide](../../guided-tour/updating-data/graphql-subscriptions/) for a more detailed explanation of how to work with subscriptions.

<FbInternalOnly>

:::note
`useSubscription` doesn't automatically add `client_subscription_id`. You may need to provide an arbitrary `client_subscription_id` to `config.variables.input`
:::

</FbInternalOnly>

<DocsRating />
