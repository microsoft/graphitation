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

### Simplest and naive implementation

The first example is the simplest one, where we just return the full response from the root-field. This means that we have a single resolver function for the `conversations` field in the `Query` type, and it returns an array of objects that match the shape of the `Conversation` type. We don't need to define any other resolver functions for the nested fields, because GraphQL will by default use the property values of the objects as the field values.

:::info
The default field resolver is a function that GraphQL uses to fetch the value of a field when no custom resolver is provided. It works by looking for a property or a method on the resolver's input that has the same name as the field. For example, if the query asks for a field called "name", the default field resolver will try to get the value of input.name or input.name(). This way, the default field resolver can pluck data from the resolvers input without any extra code.
:::

For example, if we have a data source that returns a payload like this:

```js
function getConversations() {
  return [
    {
      title: "GraphQL Basics",
      lastMessage: "Thanks for sharing!",
      participants: [
        {
          avatarURL: "https://example.com/anna.jpg",
        },
        {
          avatarURL: "https://example.com/bob.jpg",
        },
      ],
    },
    {
      title: "GraphQL Advanced",
      lastMessage: "That's very interesting!",
      participants: [
        {
          avatarURL: "https://example.com/carl.jpg",
        },
        {
          avatarURL: "https://example.com/dana.jpg",
        },
      ],
    },
  ];
}
```

Then our resolver function for the conversations field can simply return this array:

```js
const resolvers = {
  Query: {
    conversations: () => getConversations(),
  },
};
```

This approach is easy to implement, and while it works for simple queries and data sources, it has some drawbacks.

First, it can lead to inefficient resource usage and performance issues, because it always returns the full objects for each conversation and person, even if we only request some fields. For example, if we only want to get the `title` and `lastMessage` fields of each conversation, we still get the participants array with _all_ their `avatarURLs`. This may seem innocuous in this contrived example, but imagine complex data sources that require additional logic or transformations to fetch or format the data, and it can quickly add up.

Second, another limitation is that it only resolves conversations at the root level (`Query` type). But what if you want to resolve conversations nested in another type than `Query`? For example, what if you have a `Person` type that has a `conversations` field that returns all the conversations that a user participates in?

#####

The second example is more flexible and efficient, where we have explicit field resolvers for each field in the schema. This means that we have a resolver function for each field that defines how to get its value from the data source. For example, if we want to add a receivedAt field to each conversation that shows when the last message was received, we can define a resolver function for this field that calculates its value from the data source. We can also use this approach to optimize our performance by only fetching or returning the data that we need for each field. For example, if we only want to get the title and lastMessage fields of each conversation, we can avoid fetching or returning the participants array with all their avatarURLs. Here is how our resolver functions could look like in this approach:

const resolvers = {
Query: {
conversations: () => conversations
},
Conversation: {
title: (conversation) => conversation.title,
lastMessage: (conversation) => conversation.lastMessage,
participants: (conversation) => conversation.participants,
receivedAt: (conversation) => {
// some logic to calculate when the last message was received
return new Date().toISOString();
}
},
Person: {
avatarURL: (person) => person.avatarURL
}
};

This approach is more flexible and efficient than the first one, because it allows us to define custom logic and optimizations for each field in the schema. However, it also has some drawbacks. First, it may introduce more complexity and boilerplate code in our resolver functions, especially if we have many fields or nested types in our schema. For example, if we want to add more fields or types to our schema, we need to define more resolver functions for them. Second, it may not work well for modular or reusable code structures, because it couples our resolver functions with our schema definition. For example, if we want to use the same Conversation or Person type in different parts of our schema or application, we need to duplicate or import their resolver functions accordingly.

The third example is

### True text

The object type fields along the selection path may return _any_ type of data that the child field resolvers might need to perform their work—this data does not in any way need to resemble the public type that is reflected in the GraphQL schema. We call this data the resolver model, and is typically represented by JSON data from back-end services or all the way up to a full-fledged model class.

Finallly, work to transform data from the resolver models to the response can move to the leaf fields as much as possible—which are those fields that return scalar types.
