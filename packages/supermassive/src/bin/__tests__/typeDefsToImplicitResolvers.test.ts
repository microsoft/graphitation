import fs from "fs/promises";
import path from "path";
import { typeDefsToImplicitResolvers } from "../typeDefsToImplicitResolvers";

describe(typeDefsToImplicitResolvers, () => {
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
    const program = typeDefsToImplicitResolvers();
    await program.parseAsync(
      [path.join(__dirname, "./fixtures/schema.graphql")],
      { from: "user" }
    );
    expect(
      await fs.readFile(
        path.join(__dirname, "./fixtures/__generated__/schema.ts"),
        { encoding: "utf-8" }
      )
    ).toMatchSnapshot();
  });
});
