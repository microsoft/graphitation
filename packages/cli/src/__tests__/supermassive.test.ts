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

  it("should work with TypeScript 5.9+ printer API (regression test)", async () => {
    // This test verifies the fix for TypeScript 5.9 compatibility
    // TypeScript 5.9 made the printer stricter about EmitHint.SourceFile validation
    // This would throw "Debug Failure. Expected a SourceFile node" before the fix
    const program = supermassive();
    await program.parseAsync([
      "node",
      "supermassive",
      "generate-interfaces",
      path.join(__dirname, "./fixtures/schema.graphql"),
      "--output-dir=../__generated__",
    ]);

    // If we got here without throwing, the fix works
    const files = await fs.readdir(path.join(__dirname, "./__generated__"));
    expect(files.length).toBeGreaterThan(0);
  });
});
