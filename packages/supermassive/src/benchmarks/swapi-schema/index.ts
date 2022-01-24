import { makeExecutableSchema } from "@graphql-tools/schema";
import { parse } from "graphql";
import { join } from "path";
import { readFileSync } from "fs";
import resolvers from "./resolvers";

export const typeDefs = parse(
  readFileSync(join(__dirname, "./schema.graphql"), {
    encoding: "utf-8",
  }),
);

export default makeExecutableSchema({
  typeDefs,
  resolvers,
});
