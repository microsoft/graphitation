const typeDefs = `
type Message {
  id: ID!
  message: String!
}

type Chat {
  messages: [Message]!
}

type Query {
  message(id: ID!): Message!
  chat: Chat!
}

type Mutation {
  addMessage(message: String!): Message!
  removeMessage(id: ID!): Boolean!
}
`;

export default typeDefs;
