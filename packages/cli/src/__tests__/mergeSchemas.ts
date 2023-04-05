import fs from "fs/promises";
import path from "path";
import { graphitation } from "../graphitation";

describe(graphitation, () => {
  beforeEach(async () => {
    await fs.rm(
      path.join(__dirname, "fixtures", "mergeSchemas", "output.graphql"),
      {
        recursive: true,
        force: true,
      },
    );
  });

  afterEach(async () => {
    jest.restoreAllMocks().clearAllMocks();
    await fs.rm(
      path.join(__dirname, "fixtures", "mergeSchemas", "output.graphql"),
      {
        recursive: true,
        force: true,
      },
    );
  });

  it("generates from single file", async () => {
    const program = graphitation();
    const output = path.join(
      __dirname,
      "./fixtures/mergeSchemas/output.graphql",
    );
    await program.parseAsync([
      "node",
      "graphitation",
      "merge-schemas",
      "-o",
      output,
      path.join(__dirname, "./fixtures/mergeSchemas/entry-point.graphql"),
    ]);
    expect(await fs.readFile(output, { encoding: "utf-8" })).toMatchSnapshot();
  });

  it("generates from glob", async () => {
    const program = graphitation();
    const output = path.join(
      __dirname,
      "./fixtures/mergeSchemas/output.graphql",
    );
    await program.parseAsync([
      "node",
      "graphitation",
      "merge-schemas",
      "-o",
      output,
      path.join(__dirname, "./fixtures/mergeSchemas/test-*.graphql"),
    ]);
    expect(await fs.readFile(output, { encoding: "utf-8" })).toMatchSnapshot();
  });

  it("complains about missing imports", async () => {
    const warn = jest.spyOn(console, "warn").mockImplementation(() => {});
    const program = graphitation();
    const output = path.join(
      __dirname,
      "./fixtures/mergeSchemas/output.graphql",
    );
    await expect(
      program.parseAsync([
        "node",
        "graphitation",
        "merge-schemas",
        "-o",
        output,
        path.join(__dirname, "./fixtures/mergeSchemas/missing-types.graphql"),
      ]),
    ).rejects.toEqual(expect.any(Error));
    // Extended type, DateTime and wrong import
    expect(warn).toHaveBeenCalledTimes(3);
  });

  it("complains about missing imports, but allows passing with a flag", async () => {
    const warn = jest.spyOn(console, "warn").mockImplementation(() => {});
    const program = graphitation();
    const output = path.join(
      __dirname,
      "./fixtures/mergeSchemas/output.graphql",
    );
    await program.parseAsync([
      "node",
      "graphitation",
      "merge-schemas",
      "--ignore-entry-point-missing-types",
      "-o",
      output,
      path.join(
        __dirname,
        "./fixtures/mergeSchemas/missing-types-entry-point.graphql",
      ),
    ]);

    expect(await fs.readFile(output, { encoding: "utf-8" })).toMatchSnapshot();
    // Extended type and DateTime
    expect(warn).toHaveBeenCalledTimes(2);
  });
});
