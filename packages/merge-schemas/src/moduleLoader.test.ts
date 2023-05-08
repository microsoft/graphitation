import path from "path";
import { Kind } from "graphql";
import { FileSystemModuleLoader } from "./moduleLoader";

describe(FileSystemModuleLoader, () => {
  it("imports from files", async () => {
    const loader = new FileSystemModuleLoader();
    const modPath = path.resolve(
      __dirname,
      "./__tests__/fixtures/entry-point.graphql",
    );
    const result = await loader.resolveModuleFromPath(modPath);
    expect(result.rootPath).toEqual(modPath);
    expect(result.document.kind).toBe(Kind.DOCUMENT);
  });
  it("imports from packages", async () => {
    const loader = new FileSystemModuleLoader();
    const modPath = require.resolve(
      "@graphitation/merge-schema-testing-core-graphql/index.graphql",
    );
    const result = await loader.resolveModuleFromPath(
      "@graphitation/merge-schema-testing-core-graphql",
    );
    expect(result.rootPath).toEqual(modPath);
    expect(result.document.kind).toBe(Kind.DOCUMENT);
  });

  it("errors when files do not exist", () => {
    const loader = new FileSystemModuleLoader();
    const modPath = path.resolve(
      __dirname,
      "./__tests__/fixtures/I-DO-NO-EXIST.graphql",
    );
    expect(loader.resolveModuleFromPath(modPath)).rejects.toBeDefined();
  });

  it("errors for non found modules", () => {
    const loader = new FileSystemModuleLoader();
    expect(
      loader.resolveModuleFromPath(
        "@graphitation/merge-schema-testing-i-do-not-exist",
      ),
    ).rejects.toBeDefined();
  });

  it("errors for invalid packages with no main graphql", () => {
    const loader = new FileSystemModuleLoader();
    expect(
      loader.resolveModuleFromPath(
        "@graphitation/merge-schema-testing-invalid-graphql-module",
      ),
    ).rejects.toBeDefined();
  });
});
