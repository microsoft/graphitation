import { GraphQLSchema, parse } from "graphql";
import { join } from "path";
import { readFileSync } from "fs";
import resolvers from "./resolvers";
import { makeExecutableSchema } from "./makeExecutableSchema";
import { Resolvers } from "../../types";

export const typeDefs = parse(
  readFileSync(join(__dirname, "./schema.graphql"), {
    encoding: "utf-8",
  }),
);

const schema = makeExecutableSchema({
  typeDefs,
  resolvers: resolvers as Resolvers<unknown, unknown>,
});

export default schema;

export const makeSchema: () => GraphQLSchema = () =>
  makeExecutableSchema({
    typeDefs,
    resolvers: resolvers as Resolvers<unknown, unknown>,
  });
