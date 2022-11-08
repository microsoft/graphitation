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
});
