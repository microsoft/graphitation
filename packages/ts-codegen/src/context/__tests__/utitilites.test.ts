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

    expect(
      getRelativePath(
        "foobar",
        "./generated",
        "/home/test/codegen/schema.graphql",
      ),
    ).toEqual("foobar");
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

    expect(
      getRelativePath(
        "./test/models.ts",
        process.cwd(),
        path.resolve(process.cwd(), "./schema.graphql"),
      ),
    ).toEqual("./test/models");

    expect(
      getRelativePath(
        "./test",
        path.resolve(process.cwd()),
        path.resolve(process.cwd(), "./schema.graphql"),
      ),
    ).toEqual("./test");

    expect(
      getRelativePath(
        "../test",
        process.cwd(),
        path.resolve(process.cwd(), "./schema.graphql"),
      ),
    ).toEqual("../test");
  });
});
