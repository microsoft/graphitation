---
sidebar_position: 1
---

# Intro

## Preface

> GraphQL is a query language for APIs and a runtime for fulfilling those queries with your existing data. GraphQL provides a complete and understandable description of the data in your API.
>
> — [graphql.org](https://graphql.org)

While technically accurate, its brevity leaves a lot of room for misguided understanding, typically based on prior experiences.

The authors of this guide have observed that **the original premise of GraphQL is lost on most users**. On the one hand this speaks to the versatility of GraphQL, but on the other hand it means that missing key nuances can cause incorrect application of GraphQL, even in the exact same context it was designed for: **complex data-driven UI applications**.

This guide aims to teach you everything you need to understand about GraphQL from that perspective, including how to design schemas, how to implement field resolvers, and how to effectively use this to build these data-driven UIs.

:::info

This guide does not aim to replace [the canonical graphql.org site’s documentation](https://graphql.org/learn/). Some familiarity with GraphQL might be necessary for some sections, where possible the guide will link to the relevant existing documentation.

:::

## About

GraphQL is a new way of thinking about data and how to access it. It is a data query language that was invented by Facebook in 2012 to make it easier to deal with the complexity of data and state driven UI applications, combined with the scale of their workforce and codebase. GraphQL has since been open-sourced and is now used by many companies that have to deal with the same complexities.

GraphQL isn't tied to any specific database or storage engine, instead it is an abstraction over the underlying APIs, expressed using a GraphQL schema. This higher level interface is more convenient for UI developers, as it allows them to access the data in a more consistent and predictable way. Additionally, a good GraphQL schema is focussed on expressing the actual domain models and the semantics thereof, rather than the underlying API data and the many disparate forms it can take. By carefully designing your schema, you can optimize your data retrieval to get exactly the data your UI needs, and _only_ that data.
