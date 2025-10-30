const typeDefs = `
type Message {
  id: ID!
  text: String!
}

type Chat {
  messages: [Message]!
}

type Query {
  message(id: ID!): Message!
  chat: Chat!
}

type Mutation {
  addMessage(text: String!): Message!
  removeMessage(id: ID!): Boolean!
  updateMessage(id: ID!, text: String!): Message!
  shuffleMessages: Boolean!
}
`;

export default typeDefs;
