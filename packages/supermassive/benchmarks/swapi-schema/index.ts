import { makeExecutableSchema } from "@graphql-tools/schema";
import { join } from "path";
import { readFileSync } from "fs";
import resolvers from "./resolvers";

const typeDefs = readFileSync(join(__dirname, "./schema.graphql"), {
  encoding: "utf-8",
});

export default makeExecutableSchema({
  typeDefs,
  resolvers,
});
