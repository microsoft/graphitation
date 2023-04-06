---
sidebar_position: 4
id: resolution
title: GraphQL Resolution
description: How data is retrieved and assembled according to the schema and requests
---

# GraphQL Resolution

The role of an execution engine in GraphQL is to convert between underlying services into GraphQL schema types for use in the front-end. We call this “resolution”.

It does so by traversing the schema and resolving the fields requested in the query. The executor follows the structure of the query and passes the data returned by each field resolver to its child field resolvers. The executor ensures that only the fields that are requested by the client are resolved, and that the final result matches the shape of the query.

## Ask for what you need, get exactly that

GraphQL allows clients to specify **the exact data** they need from the service. Unlike traditional RESTful APIs, where clients have to make multiple requests or receive more data than they need, GraphQL lets clients define the structure of the data they want and get **_only_ that data** in a single request. This makes GraphQL APIs more efficient, flexible, and scalable.

One of the key features of GraphQL is that every field in a GraphQL schema has a corresponding field resolver function that is responsible for fetching and/or transforming the data for that field. Field resolvers can be defined on any type in the schema, not just the root types.

By using field resolvers, the GraphQL executor can achieve a high level of performance and flexibility. Clients can get exactly what they need from the service, and the service can optimize their data fetching and processing based on the client's request. This way, GraphQL enables a powerful and elegant way of building APIs that meet the needs of complex data-driven applications.

## Execution

To resolve the data of the GraphQL query, we need to define how each field in the schema is fetched from the data source. There are different ways to do this, depending on how we structure our code and how we optimize our performance. In this section, we will explore three examples of how to resolve the data of the query, starting with a naive version that just returns the full response from the root-field, to one that has explicit field resolvers for each field, and finally one that has proper models to represent the underlying data.

Let's consider the conversation list UI once more:

<table>
<tr>
<th>Conversation list</th>
<th>Schema</th>
<th>Query</th>
</tr>
<tr>
<td>
<img src={require("./images/SmallChatList.png").default} border="1" />
</td>
<td>

```graphql
type Query {
  conversations: [Conversation]
}

type Conversation {
  title: String
  lastMessage: String
  participants: [Person]
  receivedAt: String
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

### Greedy resolution

The first example is the simplest one, where we just return the full response from the root-field. This means that we have a single resolver function for the `conversations` field in the `Query` type, and it returns an array of objects that match the shape of the `Conversation` type. We don't need to define any other resolver functions for the nested fields, because GraphQL will [by default](#a-note-on-the-default-field-resolver) use the property values of the objects as the field values.

For example, if we have a data source that looks like this:

```js
const conversations = [
  {
    title: "Joshua VanBuren",
    lastMessage: "Thanks for reviewing!",
    participants: [
      {
        avatarURL: "https://example.com/joshua.jpg",
      },
    ],
    receivedAt: "10:29 AM",
  },
  {
    title: "Daichi Fukuda",
    lastMessage: "You: Thank you!!",
    participants: [
      {
        avatarURL: "https://example.com/daichi.jpg",
      },
    ],
    receivedAt: "10:20 AM",
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

This approach is easy to implement, and while it works for trivial queries and data sources, it has some drawbacks. For instance, it can lead to inefficient resource usage and performance issues, because it always returns the full objects for each conversation and person, even if we only request some fields. If we only want to get the `title` and `lastMessage` fields of each conversation, we still get the participants array with _all_ their `avatarURLs`. This may seem innocuous in this contrived example, but imagine more complex data sources that require expensive logic to fulfil the participants data, and it can quickly add up.

In conclusion, using a greedy GraphQL field resolver that does all its work in a single root-field resolver can be a simple and straightforward way to implement a schema, but it has significant drawbacks in terms of resource usage and performance. It results in over-fetching data that is not needed by the client, and wasting time and memory on processing it. A better approach is to use more granular resolver functions for each field, and only fetch and return the data that is requested by the query. This way, we can optimize our data sources and improve our response times and scalability.

:::note

#### A note on the default field resolver

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

### Lazy resolution

The second example is more flexible and efficient than the first one, where we can have explicit field resolvers for each field in the schema. These field resolver functions allow us to define how to derive the field's value from the data source.

For example, if the `receivedAt` value would not already be formatted in the data source, we can define a resolver function for this field that calculates its human-readable value from the raw format. Here is how that field resolver function could look like:

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

Similarly, the `participants` value in the data source is more likely to be a list of person IDs, than it is to be a list of full-fledged person objects. In this scenario, we need to issue an extra call to the data source to get the actual data. It should go without saying that we absolutely want this to be done only when the client needs this data, and not fetch it greedily in the `Query.conversations` root-field. Here is how that field resolver function could look like:

```js
const resolvers = {
  Conversation: {
    participants: (conversation) => getPeopleByIDs(conversation.participants),
  },
};
```

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

### Striking the right balance between implicit and explicit field resolvers

## Models

TODO: Only fetch participants when necessary, and as another model.

## DataLoader

## True text

The object type fields along the selection path may return _any_ type of data that the child field resolvers might need to perform their work—this data does not in any way need to resemble the public type that is reflected in the GraphQL schema. We call this data the resolver model, and is typically represented by JSON data from back-end services or all the way up to a full-fledged model class.

Finallly, work to transform data from the resolver models to the response can move to the leaf fields as much as possible—which are those fields that return scalar types.
