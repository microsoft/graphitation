const typeDefs = `
directive @cache(
  history: Int
) on QUERY | MUTATION | SUBSCRIPTION

type Message {
  id: ID!
  text: String!
}

type Chat {
  messages: [Message]!
}

type UserPreference {
  id: ID!
  theme: String
  language: String
  notifications: Boolean
  privacy: String
}

type Query {
  message(id: ID!): Message!
  chat: Chat!
  userPreference: UserPreference!
}

type Mutation {
  addMessage(text: String!): Message!
  removeMessage(id: ID!): Boolean!
  updateMessage(id: ID!, text: String!): Message!
  shuffleMessages: Boolean!
}
`;

export default typeDefs;
