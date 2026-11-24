import fs from "fs/promises";
import path from "path";
import { supermassive } from "../supermassive";

describe(supermassive, () => {
  beforeAll(async () => {
    await fs.rm(path.join(__dirname, "fixtures", "__generated__"), {
      recursive: true,
      force: true,
    });
  });

  afterAll(async () => {
    await fs.rm(path.join(__dirname, "fixtures", "__generated__"), {
      recursive: true,
      force: true,
    });
  });

  it("should generate", async () => {
    const program = supermassive();
    await program.parseAsync([
      "node",
      "supermassive",
      "extract-schema",
      path.join(__dirname, "./fixtures/schema.graphql"),
    ]);
    expect(
      await fs.readFile(
        path.join(__dirname, "./fixtures/__generated__/schema.ts"),
        { encoding: "utf-8" },
      ),
    ).toMatchSnapshot();
  });

  it("should generate interfaces with --generate-resolver-map", async () => {
    const program = supermassive();
    await program.parseAsync([
      "node",
      "supermassive",
      "generate-interfaces",
      path.join(__dirname, "./fixtures/schema.graphql"),
      "--output-dir=../__generated__",
      "--generate-resolver-map",
    ]);
    const files = await fs.readdir(path.join(__dirname, "./__generated__"));
    for (const file of files) {
      expect(
        await fs.readFile(path.join(__dirname, "./__generated__", file), {
          encoding: "utf-8",
        }),
      ).toMatchSnapshot();
    }
  });

  it("supports native live resolver return types", async () => {
    await supermassive().parseAsync([
      "node",
      "supermassive",
      "generate-interfaces",
      path.join(__dirname, "fixtures/schema.graphql"),
      "--output-dir=__generated__/live",
      "--live-resolver-return-types",
    ]);
    const resolvers = await fs.readFile(
      path.join(
        __dirname,
        "fixtures/__generated__/live/resolvers.interface.ts",
      ),
      "utf-8",
    );
    expect(resolvers).toContain("LiveResolverResult");
  });
});
