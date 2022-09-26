import { processImportDirective } from "../import";
import { Kind, parse, print, GraphQLError } from "graphql";
import graphql from "../../../utilities/blankGraphQLTag";
import { DefinitionImport } from "../../types";

describe(processImportDirective, () => {
  it("extracts scoped package import", () => {
    const result = processDirectives(graphql`
        @import(from: "@scoped/packageImport", defs: ["ScopedPackageImport", "ScopedPackageImport2"])
      `);

    const imp = result[0];
    expect(imp.from).toEqual("@scoped/packageImport");
    expect(imp.defs).toEqual([
      {
        typeName: "ScopedPackageImport",
        modelName: "ScopedPackageImportModel",
      },
      {
        typeName: "ScopedPackageImport2",
        modelName: "ScopedPackageImport2Model",
      },
    ]);
    expect(imp.importName).toMatchInlineSnapshot(`"NSScopedPackageImport"`);
    expect(print(imp.directive)).toMatchInlineSnapshot(
      `"@import(from: \\"@scoped/packageImport\\", defs: [\\"ScopedPackageImport\\", \\"ScopedPackageImport2\\"])"`,
    );
  });
  it("extracts package imports", () => {
    const result = processDirectives(
      graphql`
          @import(from: "packageImport", defs: ["PackageImport", "PackageImport2"])
          @import(from: "packageImport/subDir", defs: ["PackageImportSubDir"])
      `,
    );
    expect(result.length).toBe(2);
    const plain = result[0];
    expect(plain.from).toEqual("packageImport");
    expect(plain.defs).toEqual([
      {
        typeName: "PackageImport",
        modelName: "PackageImportModel",
      },
      {
        typeName: "PackageImport2",
        modelName: "PackageImport2Model",
      },
    ]);
    expect(plain.importName).toMatchInlineSnapshot(`"PackageImport"`);
    expect(print(plain.directive)).toMatchInlineSnapshot(
      `"@import(from: \\"packageImport\\", defs: [\\"PackageImport\\", \\"PackageImport2\\"])"`,
    );
    const dir = result[1];
    expect(dir.from).toEqual("packageImport/subDir");
    expect(dir.defs).toEqual([
      {
        typeName: "PackageImportSubDir",
        modelName: "PackageImportSubDirModel",
      },
    ]);
    expect(dir.importName).toMatchInlineSnapshot(`"PackageImportSubDir"`);
    expect(print(dir.directive)).toMatchInlineSnapshot(
      `"@import(from: \\"packageImport/subDir\\", defs: [\\"PackageImportSubDir\\"])"`,
    );
  });
  it('throws an error when the "from" field is not String', () => {
    expect.assertions(1);
    try {
      processDirectives(
        graphql`
        @import(from: ["../upDir"], defs: ["UpDir"])
      `,
      );
    } catch (err) {
      expect(err).toBeInstanceOf(GraphQLError);
    }
  });
  it('throws an error when the "defs" field is not Array of Strings', () => {
    expect.assertions(2);
    try {
      processDirectives(
        graphql`
        @import(from: "../upDir", defs: [1])
      `,
      );
    } catch (err) {
      expect(err).toBeInstanceOf(GraphQLError);
    }

    try {
      processDirectives(
        graphql`
        @import(from: "../upDir", defs: "UpDir")
      `,
      );
    } catch (err) {
      expect(err).toBeInstanceOf(GraphQLError);
    }
  });
  it("extracts locally scoped imports", () => {
    const result = processDirectives(
      graphql`
        @import(from: "../upDir", defs: ["UpDir"])
        @import(from: "../../foo/bar/Dir", defs: ["FooBarDir"])
        @import(from: "./loc", defs: ["LocalImport"])
      `,
    );
    expect(result.length).toBe(3);
    const upDir = result[0];
    expect(upDir.from).toEqual("../upDir");
    expect(upDir.defs).toEqual([
      {
        typeName: "UpDir",
        modelName: "UpDirModel",
      },
    ]);
    expect(upDir.importName).toMatchInlineSnapshot(`"UpUpDir"`);
    expect(print(upDir.directive)).toMatchInlineSnapshot(
      `"@import(from: \\"../upDir\\", defs: [\\"UpDir\\"])"`,
    );
    const upUpDir = result[1];
    expect(upUpDir.from).toEqual("../../foo/bar/Dir");
    expect(upUpDir.defs).toEqual([
      {
        typeName: "FooBarDir",
        modelName: "FooBarDirModel",
      },
    ]);
    expect(upUpDir.importName).toMatchInlineSnapshot(`"UpUpFooBarDir"`);
    expect(print(upUpDir.directive)).toMatchInlineSnapshot(
      `"@import(from: \\"../../foo/bar/Dir\\", defs: [\\"FooBarDir\\"])"`,
    );
    const loc = result[2];
    expect(loc.from).toEqual("./loc");
    expect(loc.defs).toEqual([
      {
        typeName: "LocalImport",
        modelName: "LocalImportModel",
      },
    ]);
    expect(loc.importName).toMatchInlineSnapshot(`"CwdLoc"`);
    expect(print(loc.directive)).toMatchInlineSnapshot(
      `"@import(from: \\"./loc\\", defs: [\\"LocalImport\\"])"`,
    );
  });
});

function processDirectives(str: string): DefinitionImport[] {
  let documentNode = parse(`
     extend schema ${str}
  `);
  if (documentNode.definitions[0]?.kind === Kind.SCHEMA_EXTENSION) {
    let directiveNodes = documentNode.definitions[0].directives || [];
    return directiveNodes.map(processImportDirective);
  } else {
    throw new Error("Invalid directive");
  }
}
