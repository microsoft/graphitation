import { getRelativePath } from "../utilities";
import path from "path";

describe("getRelativePath", () => {
  test('"from" is package', () => {
    expect(
      getRelativePath(
        "@msteams/test",
        "./generated",
        "/home/test/codegen/schema.graphql",
      ),
    ).toEqual("@msteams/test");
  });
  test('"from" is undefined', () => {
    expect(
      getRelativePath(
        undefined,
        "./generated",
        "/home/test/codegen/schema.graphql",
      ),
    ).toEqual(null);
  });
  test('"from" is relative path', () => {
    expect(
      getRelativePath(
        "./test/models.ts",
        path.resolve(process.cwd(), "./generated"),
        path.resolve(process.cwd(), "./schema.graphql"),
      ),
    ).toEqual("../test/models");
  });
});
