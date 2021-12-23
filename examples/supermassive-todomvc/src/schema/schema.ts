import typeDefs from "./typeDefs.graphql";
import { resolvers } from "./resolvers";
import { makeExecutableSchema } from "@graphql-tools/schema";

const schema = makeExecutableSchema({
  typeDefs,
  resolvers,
});

export default schema;
