---
sidebar_position: 4
id: resolution
title: GraphQL Resolution
description: How data is retrieved and assembled according to the schema and requests
---

# GraphQL Resolution

The role of an execution engine in GraphQL is to convert between underlying services into GraphQL schema types for use in the front-end. We call this “resolution”.

It does so by traversing the schema and resolving the fields requested in the query. The executor follows the structure of the query and passes the data returned by each field resolver to its child field resolvers. The executor ensures that only the fields that are requested by the client are resolved, and that the final result matches the shape of the query.

## Get only what you need

A core part of GraphQL is that it allows clients to specify **the exact data** they need from the service. Unlike traditional RESTful APIs, where clients have to make multiple requests or receive more data than they need, GraphQL lets clients define the structure of the data they want and get **_only_ that data** in a single request. Notably, this means that the client does not need to pay the price for any business logic required for fields that are not needed by the client. This makes GraphQL APIs more efficient, flexible, and scalable to clients that have such needs.

## Execution

To resolve the data of the GraphQL query, we need to define how each field in the schema is fetched from the data source. There are different ways to do this, depending on how we structure our code and how we optimize our performance. In this section, we will explore two examples of how to resolve the data of the query, starting with a naive version that simply returns the full entire response from the root-field, to one that has explicit field resolvers for each field with custom logic.

But first, let's quickly cover how the executor will process your query. Let's consider the conversation list UI once more:

<table>
<tr>
<th>Schema</th>
<th>Query</th>
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
  receivedAt: String
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
    title
    lastMessage
    receivedAt
    participants {
      avatarUrl
    }
  }
}
```

</td>
</tr>
</table>

```mermaid
graph TD
  A[Query.conversations] --> C["map(Array&lt;Conversation&gt;)"]
  C --> D[Conversation.title]
  C --> E[Conversation.lastMessage]
  C --> F[Conversation.receivedAt]
  C --> G[Conversation.participants]
  G --> H["map(Array&lt;Person&gt;)"]
  H --> I[Person.avatarURL]
```

In this case, when we query for conversations, GraphQL will:

1. Execute the resolver function for the `Query.conversations` field, which returns an array of `Conversation` objects.
1. Then, for each individual `Conversation` object in the array, GraphQL will execute the resolver function for the `Conversation.title`, `Conversation.lastMessage`, `Conversation.receivedAt`, and `Conversation.participants` fields.
1. And finally, for each `Person` object in the `Conversation.participants` array, GraphQL will execute the resolver function for the `Person.avatarURL` field.

Crucially, each field resolver only resolves exactly that which it is named after. The `Query.conversations` field returns a list of conversations from the data source, it does not transform any values for fields that need custom logic applied, nor does it fetch the person objects for the `Conversation.participants` field.

:::info
For a more details on the functional bits of execution, please refer to [this graphql.org page](https://graphql.org/learn/execution/), or [the spec](http://spec.graphql.org/October2021/#sec-Execution).
:::

### 👎 Greedy resolution

The first example is the simplest one, where we just return the full response from the root-field. This means that we have a single resolver function for the `conversations` field in the `Query` type, and it returns an array of objects that match the shape of the `Conversation` type. We don't need to define any other resolver functions for the nested fields, because GraphQL will [by default](#a-note-on-the-default-field-resolver) use the property values of the objects as the field values.

For example, if we have a data source that looks like this:

```js
const conversations = [
  {
    title: "Joshua and Daichi",
    lastMessage: "You: Thank you!!",
    receivedAt: "10:29 AM",
    participants: [
      {
        avatarURL: "https://example.com/joshua.jpg",
      },
      {
        avatarURL: "https://example.com/daichi.jpg",
      },
    ],
  },
  {
    title: "Kadji Bell",
    lastMessage: "You: I like the idea, let’s pitch it!",
    participants: [
      {
        avatarURL: "https://example.com/kadji.jpg",
      },
    ],
    receivedAt: "10:02 AM",
  },
];
```

Then our resolver function for the conversations field can simply return this array:

```js
const resolvers = {
  Query: {
    conversations: () => conversations,
  },
};
```

This approach is easy to implement, and while it works for trivial queries and data sources, it has some drawbacks. For instance, it does not follow the core idea of GraphQL to [get only what you need](#get-only-what-you-need), which leads to inefficient resource usage and performance issues. If we only want to get the `title` and `lastMessage` fields of each conversation, we still get the participants array with _all_ their `avatarURLs`. This may seem innocuous in this contrived example, but imagine more complex data sources that require expensive logic to fulfil the participants data, and it can quickly add up.

:::info
It is important to realize that what a field resolver returns does **not** equal what is returned to the client. Only fields selected in the request document are ever returned. If we had executed the following query, with the above resolver and rich data, the executor would still only ever send the `title` values to the client.

```graphql
query {
  conversations {
    title
  }
}
```

:::

:::note

### A note on the default field resolver

The default field resolver is a function that GraphQL uses to resolve the value of a field when no explicit resolver is provided. It works by looking up the property with the same name as the field on the parent object, or calling it as a function if it is one. For example, if we have a field called `title` on a type called `Conversation`, and no resolver for it, the default field resolver will try to return `conversation.title` or call `conversation.title()` if it exists.

The following set of resolvers has the same result as the above, but _without_ relying on the default field resolver:

```js
const resolvers = {
  Query: {
    conversations: () => conversations,
  },
  Conversation: {
    title: (conversation) => conversation.title,
    lastMessage: (conversation) => conversation.lastMessage,
    participants: (conversation) => conversation.participants,
    receivedAt: (conversation) => conversation.receivedAt,
  },
  Person: {
    avatarURL: (person) => person.avatarURL,
  },
};
```

:::

### 👍 Lazy resolution

The second example is more flexible and efficient than the first one, where we can have explicit field resolvers for each field in the schema. These field resolver functions allow us to define how to derive the field's value from the data source.

For example, if the `receivedAt` value would not already be formatted in the data source, we can define a resolver function for this field that calculates its human-readable value from the raw format. Here is what that field resolver function could look like:

```js
const resolvers = {
  Conversation: {
    // Transform the `conversation.receivedAt` value to HH:MM AM/PM
    receivedAt: (conversation) => {
      const date = new Date(conversation.receivedAt);
      return date.toLocaleTimeString("en-US", {
        hour: "numeric",
        hour12: true,
        minute: "numeric",
      });
    },
  },
};
```

Similarly, the `participants` value in the data source is more likely to be a list of person IDs, than it is to be a list of full-fledged person objects. In this scenario, we need to issue an extra call to the data source to get the actual data. It should go without saying that we absolutely want this to be done only when the client needs this data, and not fetch it greedily in the `Query.conversations` root-field. Here is what that field resolver function could look like:

```js
const resolvers = {
  Conversation: {
    participants: (conversation) => getPeopleByIDs(conversation.participantIDs),
  },
};
```

Neat.

#### Flexibility for different needs

We can use this approach to optimize our performance by _only_ fetching or returning the data that we need for each field. For example, if we only want to get the `title`, `lastMessage`, and `receivedAt` fields of each conversation, we can avoid fetching or returning the participants array with all their `avatarURL`s.

As you have learned in [The Design of GraphQL](the-design-of-graphql.md), this flexibility is at the heart of its design for composition of data requirements.

#### Consistency throughout the schema

Another benefit of using explicit field resolvers is that they can apply to any field that returns a `Conversation` type, not just the top-level query. This means that you can reuse the same logic and transformations for different queries that also involve conversations. For instance, if you have a `Person` type that has a `conversations` field which returns all the conversations that a user participates in, you can use the same field resolvers as you would use for the `Query.conversations` result. This way, you can avoid inconsistency in your API's results, while staying flexible in the queries it can execute.

In this case, only the following schema addition would be necessary to enable the above example:

```graphql
type Person {
  conversations: [Conversation]
}
```

Plus a field resolver function that does no work other than getting the conversations based on the appropriate context:

```js
const resolvers = {
  Person: {
    conversations: (person) => getConversationsForPersonById(person.id),
  },
  Query: {
    person: (_, args) => getPerson(args.id),
  },
};
```

With that in place, you now have a schema that allows lazy resolution with a query like the following:

```graphql
query {
  person(id: "daichi-fukuda") {
    conversations {
      title
    }
  }
}
```

### Striking the right balance

Using a greedy GraphQL field resolver that does all its work in a single field resolver can _seem_ like a simple and straightforward way to implement a schema, but **it has significant drawbacks** in terms of resource usage and performance. It results in over-fetching data that is not needed by the client, and wasting time and memory on processing it.

In conclusion, lazy field resolvers are **the recommended way** to implement any field that requires some custom logic. This can include scalar fields that need some derivation or transformation, as well as object fields that need to fetch associated data from other sources. Only for fields that are already present in the parent type’s data source, and need no further processing, you can rely on the default field resolver—this usually applies to scalar fields only.

## Models

In GraphQL execution, there is no need for the GraphQL schema to match the data source. This means that we can design our schema based on the needs of our clients, rather than the structure of our database or API. In fact, very often we will want to hide values that the clients don't need at all or those values from which we derive the field's result.

For example, we might have a field in the schema called `fullName`, which concatenates the `firstName` and `lastName` values from our model. We don't need to expose those fields in our schema if they are not useful to our clients, but the field resolver _does_ need access to the model data for it to be able to do its work.

```graphql
type Person {
  fullName: String!

  # NOTE: These fields do NOT exist in the schema.
  # firstName: String!
  # lastName: String!
}
```

```ts
const resolvers = {
  Person: {
    fullName: (
      person: DatabaseTablePersonRow,
    ): SchemaTypes.Person["fullName"] =>
      `${person.firstName} ${person.lastName}`,
  },
};
```

Here, the `person` argument has all the underlying data we need. We call such a source, **the model**. _Crucially_, the model type is **not** equal to the schema type. The model type is where the data comes _from_, the schema type's field is what the resolver transforms the data _to_.

A model can be a raw response from the data source, an intermediate representation, or a full fledged model class instance. A raw data source response is the most basic form of a model. It could be a row from a database table, a document from a database, or a JSON object from an API response.

An intermediate representation is a model that has some processing or transformation applied to it, perhaps ahead of time. For example, we might have a model that adds some computed properties during a background synchronization task. Note that this should **not** be transformation to full schema types.

A full fledged model class instance is a model that has methods and behaviors associated with it. For example, we might have a model class that implements validation rules, business logic, or custom methods for manipulating the data.

Depending on our use case and preferences, we can choose any of these forms of models for our GraphQL execution. The only requirement is that our resolver functions can access the relevant properties of our models to return the correct values for our schema fields.

:::tip
A good way to think about a model, is that whatever your data source returns **is your model**. In turn, these models are what the resolvers operate on to _lazily_ map underlying data to the public schema types.
:::

:::caution

#### A warning for statically typed language users

For type-safe field resolver implementations, you will typicaly want to generate typings to use in your resolvers. By default, codegen tools will typically emit typings that _exactly_ match the schema types. What this means is that your field resolver function will be required to return the data for child fields already transformed according to the schema. I.e. this forces you to apply [greedy resolution](#-greedy-resolution). No bueno.

You will therefore absolutely want to pick a codegen tool that allows you to specify custom model typings for specific schema types. In the TypeScript space, such tools include:

- Our own [graphitation supermassive codegen](https://github.com/microsoft/graphitation/tree/main/packages/cli), which allows you to annotate your schema definition with the model typings to use.
- The popular [graphql-codegen](https://the-guild.dev/graphql/codegen) tool, which [allows you to provide configuration](https://the-guild.dev/blog/better-type-safety-for-resolvers-with-graphql-codegen) with schema type to model type mappings.

:::

## Performant data loading

Integral to resolution of a graph of connected data, is that a query will end up containing many entities of the same kind, or perhaps even contain the same entity multiple times. For instance, for each conversation fetch all participants—a classic N+1 problem.

These entities might be necessary for unrelated parts of the application, but still, for performance reasons we want to be able to batch that entity data loading. [DataLoader](https://github.com/graphql/dataloader) is a utility used to abstract request batching in GraphQL. It allows you to reason about a batch of requests, **without** needing to do so in the field resolver functions—keeping them decoupled and without sacrificing the performance of batched data loading.

#### Basic data loading

Let’s look at how DataLoader could be used for the participants in our chat-list example. First we define the DataLoader instance, like so:

```js
const personLoader = new DataLoader(async (ids) => {
  return getPeopleFromServiceByIDs(ids);
});
```

In essence, DataLoader takes a function that, given a set of IDs (or keys), will return a promise for a set of values.

Then, for an individual conversation in the chat-list, we could use the DataLoader instance, like so:

```js
const resolvers = {
  Conversation: {
    participants: async (conversation) => {
      return personLoader.loadMany(conversation.participantIds);
    },
  },
};
```

This example isn't all that ground-breaking, as we have the list of IDs in the one field resolver already and can easily load them as a batch. (The only true benefit would be the caching of the people data, allowing for fast retrieval when resolving the same people again elsewhere in the query.)

#### Decoupled batching

It gets more interesting when we consider that the execution engine will resolve the participants for each conversation in the list **in parallel**. You could imagine it to work something like this pseudo code:

```js
Promise.all([
  Conversation.participants({ ... }),
  Conversation.participants({ ... })
])
```

Now, when we pass a single ID (_or set_) to the DataLoader, we expect a single value (_or respective set_) to be returned; yet still batch them with the participants of _all_ other conversations. How this works is that all requests made of a DataLoader during a single tick of the JavaScript runloop, will get batched together and passed to the batch function as a single list.

So, given our [prior example data](#👎-greedy-resolution):

1. The execution engine would invoke the `Conversation.participants` field resolver twice.
   - Once in a conversation with Joshua and Daichi: `personLoader.loadMany(["joshua", "daichi"])`
   - And once in a conversation with Kadji: `personLoader.loadMany(["kadji"])`
1. The DataLoader instance would then receive the following enqueued IDs as a _single_ list: `["joshua", "daichi", "kadji"]`
1. And return the requested people to the 2 invocations of the `Conversation.participants` field resolver for further transforming.
1. Finally, the execution engine moves on to the next level of the query, by invoking the `Person.avatarURL` field resolver for each of the 3 people.

#### Caching

Additionally, DataLoader provides caching of entities during a single execution pass of an operation. This means that any participants present in all conversations, such as the authenticated user, will only get requested once. But also, if one of those people is requested again later on in the query, DataLoader will simply return it immediately.

:::info
A walkthrough of the DataLoader v1 source code by one of its authors, Lee Byron. While the source has changed since this video was made, it is still a good overview of the rationale of DataLoader and how it works.

<a href="https://youtu.be/OQTnXNCDywA" target="_blank" alt="DataLoader Source Code Walkthrough"><img src="https://img.youtube.com/vi/OQTnXNCDywA/0.jpg" /></a>
:::
