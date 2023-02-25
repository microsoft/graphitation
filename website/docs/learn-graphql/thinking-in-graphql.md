---
sidebar_position: 3
id: thinking-in-graphql
title: Thinking in GraphQL
description: How to think of the GraphQL abstraction layer and its purpose.
---

# Thinking in GraphQL

As you have learned in [the design of GraphQL](./the-design-of-graphql.md) section, GraphQL was designed to allow components to express their own data requirements and for those requirements to be composable into one or more larger pieces of UI, whilst not introducing any unnecessary coupling between the various components that make up the larger UI. There is one part of this equation that we have not touched on yet, however, which is the other side of the data contract: the schema.

## Abstractions for complex data-driven UI

The GraphQL schema encodes the data requirements that the host is expected to be able to provide to the UI. At _minimum_, this schema will be an intersection of all of the data requirements expressed by the UIs—but it may be a superset because of past or future UI design iterations.

It is very natural to initially view GraphQL from a "back-end" perspective, but this way of thinking will lead your schema design down the wrong path. Instead, you should view the schema as sitting in between your back-end and the front-end.

:::note
Because of this, GraphQL is sometimes jokingly referred to as the "middle-end".
:::

When understanding that this schema is _in service of_ the UI, it then logically follows that the schema exposes the domain data in ways that will very much resemble the way in which the data is presented in the UI.

For instance, the UI cares about presenting a conversation with its messages, associated authors and their avatar, and so on and so forth. It does not care about:

- the conversation metadata coming from a different back-end service than the author metadata
- that in some cases the back-end might have denormalised message metadata onto the conversation
- that multiple upstream services might return different subsets of what is semantically speaking the same conversation object
- or even the very act of fetching the data from the various upstream services

These are the types of implementation details that you want to abstract away from complex data-driven UI code, as that makes it easier to reason about and thus to maintain/optimise over time. Additionally, when thinking of complex applications, you will want to encapsulate business logic in a way that allows you to re-use it for other UIs, or perhaps even compute/transform the data in a background thread.

All of these needs are met by a GraphQL schema that acts as the abstraction layer between your back-end and front-end.
