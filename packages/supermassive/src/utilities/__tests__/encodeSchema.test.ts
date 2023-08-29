import { encodeASTSchema } from "../encodeASTSchema";
import { parse } from "graphql";
import { readFileSync } from "fs";
import { join } from "path";

export const schemaSDL = parse(
  readFileSync(join(__dirname, "./fixtures/schema.graphql"), {
    encoding: "utf-8",
  }),
);

describe(encodeASTSchema, () => {
  test("correctly encodes sample AST schema", () => {
    const encoded = encodeASTSchema(schemaSDL);
    expect(encoded).toMatchSnapshot();
  });
});
