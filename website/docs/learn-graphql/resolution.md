---
sidebar_position: 4
id: resolution
title: GraphQL Resolution
description: How data is retrieved and assembled according to the schema and requests
---

# GraphQL Resolution

:::note
Before learning how to build your resolvers, please first make sure that you understand [how to think in GraphQL](./thinking-in-graphql.md).
:::

## Ask for what you need, get exactly that

> Send a GraphQL query to your API and get exactly what you need, nothing more and nothing less. GraphQL queries always return predictable results. Apps using GraphQL are fast and stable because they control the data they get, not the server.

While this quote from [the canonical graphql site](https://graphql.org) accurately captures the external facing characteristics of a GraphQL API, it is important to note that because the application can get exactly and _only_ the data it needs for a specific piece of UI, the resolution part of a GraphQL request should **also** _only_ perform the work necessary to satisfy that exact request.

The GraphQL executor makes this possible by backing every single field in a GraphQL API by a distinct field **resolver** that transforms data it receives from its parent field resolver. The executor will only invoke the field resolvers for those fields that were selected in the request, ensuring you only pay the overhead when you need it.

## Execution

<table>
<tr>
<th>Schema</th>
<th>Models</th>
<th>Resolvers</th>
</tr>
<tr>
<td>

```graphql
type Query {
  conversations: [Conversation]
}

type Conversation {
  title: String
  lastMessage: String
  participants: [Person]
}

type Person {
  avatarURL: String
}
```

</td>
<td>

```graphql
query {
  conversations {
    participants {
      avatarUrl
    }
    title
    lastMessage
    receivedAt
  }
}
```

</td>
</tr>
</table>

The object type fields along the selection path may return _any_ type of data that the child field resolvers might need to perform their work—this data does not in any way need to resemble the public type that is reflected in the GraphQL schema. We call this data the resolver model, and is typically represented by JSON data from back-end services or all the way up to a full-fledged model class.

Finallly, work to transform data from the resolver models to the response can move to the leaf fields as much as possible—which are those fields that return scalar types.
