import { buildSchema, Source } from "graphql";
import { readFileSync } from "fs";
// import invariant from "invariant";

// TODO: Just a dirty hack to side-step this issue for now.
const schemaPath = process.env.SCHEMA_PATH;
// invariant(schemaPath, "Expected the SCHEMA_PATH env variable to be set");

export const schema = schemaPath
  ? buildSchema(new Source(readFileSync(schemaPath, "utf-8"), schemaPath))
  : undefined;
