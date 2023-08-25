import { encodeSchema } from "../encodeSchema";
import { parse } from "graphql";
import { readFileSync } from "fs";
import { join } from "path";

export const schemaSDL = parse(
  readFileSync(join(__dirname, "./fixtures/schema.graphql"), {
    encoding: "utf-8",
  }),
);

describe(encodeSchema, () => {
  test("correctly encodes sample schema", () => {
    const encoded = encodeSchema(schemaSDL);
    expect(encoded).toMatchSnapshot();
  });
});
