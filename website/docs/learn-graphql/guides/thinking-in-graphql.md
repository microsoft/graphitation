---
sidebar_position: 3
id: thinking-in-graphql
title: Thinking in GraphQL
description: How to think of the GraphQL abstraction layer and its purpose.
---

# Thinking in GraphQL

:::info
This section shows GraphQL query and schema definition syntax. The first part of [this upstream guide](https://graphql.org/learn/schema/) will be useful to explain any bits that are not immediately clear.
:::

As you have learned in [the design of GraphQL](./the-design-of-graphql.md) section, GraphQL was designed to allow components to express their own data requirements, and for those requirements to be composable into one or more larger UIs—whilst not introducing any unnecessary coupling between the various components that make up the larger UI. There is one part of this equation that we have not touched on yet, however, which is the other side of the data contract: the schema.

## Abstractions for complex data-driven UI

The GraphQL schema encodes the data requirements that the host is expected to be able to provide to the UI. At _minimum_, this schema will be an intersection of all of the data requirements expressed by the UIs—but it may be a superset because of past or future UI design iterations.

It is very natural to initially view GraphQL from a "back-end" perspective, but this way of thinking will lead your schema design down the wrong path. Instead, you should view the schema as sitting in between your back-end and the front-end. Once you understand that this schema is _in service of_ the UI, it then logically follows that the schema exposes the domain data in ways that will very much resemble the way in which the data is presented in the UI.

For instance, a conversation list UI might care about presenting a list of conversations the user is in, with their last messages, associated participants, their avatars, and so on and so forth. It does not care about:

- the conversation metadata coming from a different back-end service than the participant metadata
- that in some cases the back-end might have de-normalized [parts of] message metadata onto the conversation
- that multiple back-end services might return different subsets for what is, semantically speaking, the same conversation object
- or even the very act of fetching the data from the various back-end services

These are the types of implementation details that you want to abstract away from complex data-driven UI code, as that makes it easier to reason about and thus to maintain/optimize over time. Additionally, when thinking of complex applications, you will want to encapsulate business logic in a way that allows you to re-use it for other UIs, or perhaps even compute/transform the data in a background thread.

All of these needs are met by a GraphQL schema that acts as the abstraction layer between your back-end and front-end.

## The “graph” in GraphQL

Another important UI consideration is rendering performance, or sometimes perceived performance. The former is achieved by having all data available that is necessary, for the initial state of the UI that the user should see, such that only a single render pass is required. (Sometimes this might mean that it can take a little while longer before rendering can start, but even then a single render pass can still provide an improvement to perceived performance.)

Ideally all this data can be provided within a reasonable time-frame, but even then there are provisions in state-of-the-art GraphQL stacks that allow you to design a controlled loading experience using [the “render-as-you-fetch” pattern](https://17.reactjs.org/docs/concurrent-mode-suspense.html#traditional-approaches-vs-suspense), as outlined in [this in-depth presentation](https://www.youtube.com/watch?v=Tl0S7QkxFE4) by a Facebook/Relay engineer.

All in all, what this means is that the schema _should_ enable a piece of UI to fetch all data it needs, in a single request. This is where “the graph” comes in, which means that the types that make up the schema are connected to each other in semantically meaningful ways and can be retrieved as a meaningful whole.

:::note

### Broad-Query

This concept might seem foreign even to those already familiar with GraphQL. To solve this at Microsoft, we had to go as far as invent a new name for this very core concept: **Broad-Query**.

However, because in GraphQL _all_ queries are meant to be “broad”, we will **not** keep repeating the “Broad-Query” term. After all, we want you to walk away from this guide as someone who truly understands GraphQL!
:::

### 👍 Schema design from front-end perspective

When designing the schema in a vacuum, it might be hard to imagine what those connections should be. However, when considered from the perspective of a concrete piece of UI, and working your way backwards, it actually becomes a lot easier.

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

The UI components were probably very natural to imagine, right? Well, as you can see, the GraphQL query you would want to be able to write is an equally natural extrapolation.

Finally, completing our top-down approach from UI design to GraphQL schema, the schema to power this would need to look like this:

```graphql
type Query {
  conversations: [Conversation]
}

type Conversation {
  participants: [Person]
  title: String
  lastMessage: String
  receivedAt: String
}

type Person {
  avatarURL: String
}
```

### 👎 Schema design from back-end perspective

To contrast, let’s look at a back-end perspective schema, and how it makes it impossible to fetch all data in a single request.

```graphql
type Query {
  conversations: [Conversation]
  person(id: ID): Person
}

type Conversation {
  participantIDs: [ID]
}
```

In this case, every root-field maps to a back-end service, and it of course does not return the full data for each related entity in its response payload, but rather contains foreign-keys to those related entities.

Because we can only get the IDs of participants in a conversation, rather than the actual `Person` objects they refer to, we are being forced to make an additional request for _each_ participant in all of the conversations in the list. This is the N+1 problem and forces the UI to perform a waterfall of requests. This in turn will lead to a slow loading experience or staggered UI rendering.

## Generic _and_ domain-specific

The benefit of GraphQL is that it allows you to design your data schema in a way that reflects the domain of your application, rather than the structure of your database or the layout of your UI. This means that you can define types and fields that represent the entities and relationships in your domain, and expose them through a single endpoint that can be queried in a concise manner.

However, this does not mean that you should create a schema that is tailored to a specific UI component or view. Doing so would limit the reusability and composability of your schema, and make it harder to evolve over time. Instead, you should aim to create a schema that is generic enough to support any UI requirement, but still specific enough to capture the domain logic and constraints.

### Query design

For example, a “person” whose name is rendered in one place of the UI, is the same “person” whose email address is rendered elsewhere in the UI. Modeling this with a single GraphQL type (e.g. `Person`), regardless of what data source the data originates, allows you to have a single source of truth to consider.

For example, this React component and GraphQL fragment:

```jsx
function PersonAvatar(props) {
  const person = useFragment(
    graphql`
      fragment PersonAvatarFragment on Person {
        avatarUrl
      }
    `,
    props.person,
  );
  return <img src={person.avatarUrl} />;
}
```

Can be used in _any_ component hierarchy that embeds a "person". Such as a chat-list item:

```jsx
function ChatListItem(props) {
  const conversation = useFragment(
    graphql`
      fragment ChatListItemFragment on Conversation {
        title
        participants {
          ...PersonAvatarFragment
        }
      }
    `,
    props.conversation,
  );
  return (
    <li>
      <h3>{conversation.title}</h3>
      {conversation.participants.map(person => <PersonAvatar person={person}>)}
    </li>
  );
}
```

Or in a signed-in user control:

```jsx
function MeControl(props) {
  const { me } = useFragment(
    graphql`
      fragment MeControlFragment on Query {
        me {
          displayName
          ...PersonAvatarFragment
        }
      }
    `,
    props.query,
  );
  return (
    <div>
      <h3>Signed-in as {me.displayName}</h3>
      <PersonAvatar person={me}>
    </div>
  );
}
```

But also crucial to a performant architecture when dealing with a complex data-driven application—_and as you will learn more about in [the GraphQL client guide](./graphql-client.md)_—because now the person avatar is backed by a single source of truth, updating the `Person` record in the GraphQL client's data-store with a new `avatarUrl` allows the frameworks to know exactly all of the places in the UI where that data is needed and thus which components to re-render.

I.e. the following pseudo-code is all it takes to automatically re-render the `PersonAvatar` in the chat-list for each conversation the signed-in user participates in, as well as in the signed-in user control:

```js
client.update({
  type: "Person",
  id: "42",
  avatarUrl: "http://example.com/new-me-who-dis",
});
```

## Conclusion

Once you start applying these patterns, you will notice how easy it becomes to re-use UI components and their fragments in various different component hierarchies, and also how easy it becomes to _update_ that data in a single place and have the change reflected everywhere in the UI.

This is where it all comes together and GraphQL truly shines ☀️
