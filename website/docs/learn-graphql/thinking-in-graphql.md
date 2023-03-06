---
sidebar_position: 3
id: thinking-in-graphql
title: Thinking in GraphQL
description: How to think of the GraphQL abstraction layer and its purpose.
---

# Thinking in GraphQL

As you have learned in [the design of GraphQL](./the-design-of-graphql.md) section, GraphQL was designed to allow components to express their own data requirements, and for those requirements to be composable into one or more larger UIs—whilst not introducing any unnecessary coupling between the various components that make up the larger UI. There is one part of this equation that we have not touched on yet, however, which is the other side of the data contract: the schema.

## Abstractions for complex data-driven UI

The GraphQL schema encodes the data requirements that the host is expected to be able to provide to the UI. At _minimum_, this schema will be an intersection of all of the data requirements expressed by the UIs—but it may be a superset because of past or future UI design iterations.

It is very natural to initially view GraphQL from a "back-end" perspective, but this way of thinking will lead your schema design down the wrong path. Instead, you should view the schema as sitting in between your back-end and the front-end. Once you understand that this schema is _in service of_ the UI, it then logically follows that the schema exposes the domain data in ways that will very much resemble the way in which the data is presented in the UI.

For instance, a conversation list UI might care about presenting a list of conversations the user is in, with their last messages, associated authors, their avatars, and so on and so forth. It does not care about:

- the conversation metadata coming from a different back-end service than the author metadata
- that in some cases the back-end might have denormalised [parts of] message metadata onto the conversation
- that multiple back-end services might return different subsets for what is, semantically speaking, the same conversation object
- or even the very act of fetching the data from the various back-end services

These are the types of implementation details that you want to abstract away from complex data-driven UI code, as that makes it easier to reason about and thus to maintain/optimise over time. Additionally, when thinking of complex applications, you will want to encapsulate business logic in a way that allows you to re-use it for other UIs, or perhaps even compute/transform the data in a background thread.

All of these needs are met by a GraphQL schema that acts as the abstraction layer between your back-end and front-end.

## The “graph” in GraphQL

Another important UI consideration is rendering performance, or sometimes perceived performance. The former is achieved by having all data, that is necessary for the initial state of the UI the user should see, such that only a single render pass is needed. Sometimes this might mean that it can take a little while longer before rendering can start, but even then a single render pass can still provide an improvement to perceived performance.

Ideally all this data can be provided within a reasonable time-frame, but even then there are provisions in state-of-the-art GraphQL stacks that allow you to design a controlled loading experience, using the “render-as-you-fetch” pattern.

:::info
For more information on render-as-you-fetch see [this React article](https://17.reactjs.org/docs/concurrent-mode-suspense.html#traditional-approaches-vs-suspense) or [this in-depth talk](https://www.youtube.com/watch?v=Tl0S7QkxFE4) by a Facebook engineer.
:::

All in all, what this means is that the schema _should_ enable a piece of UI to fetch all data it needs, in a single request. This is where “the graph” comes in, which means that the types that make up the schema are connected to each other in semantically meaningful ways and can be retrieved in the context of that connection.

When designing the schema in a vacuum, it might be hard to imagine what those connections should be. However, when considered from the UI perspective it actually becomes a lot easier.

Let's consider the conversation list UI example again:

<table>
<tr>
<th>Conversation list</th>
<th>UI components</th>
<th>GraphQL query</th>
</tr>
<tr>
<td>
<img src={require("./images/SmallChatList.png").default} border="1" />
</td>
<td>

```jsx
<ChatList>
  <ChatListItem>
    <Avatar />
    <Title />
    <LastMessage />
    <Timestamp />
  </ChatListItem>
</ChatList>
```

</td>
<td>

```graphql
query {
  conversations {
    author {
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

The UI components were probably very natural to imagine, right? Well, as you can see, the GraphQL query you would want to be able to write is an equally natural extrapolation.

Finally, completing our top-down approach from UI design to GraphQL schema, the schema to power this would need to look like this:

```graphql
type Query {
  conversations: [Conversation]
}

type Conversation {
  author: Person
  title: String
  lastMessage: String
  receivedAt: String
}

type Person {
  avatarUrl: String
}
```
