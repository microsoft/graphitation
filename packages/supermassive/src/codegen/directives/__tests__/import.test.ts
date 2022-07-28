import { processImportDirective } from "../import";
import { DirectiveNode, Kind, parse, print } from "graphql";
import graphql from "../../../utilities/blankGraphQLTag";
import { DefinitionImport } from "../../types";

describe(processImportDirective, () => {
  it("extracts scoped package import", () => {
    const result = processDirectives(graphql`
        @import(from: "@scoped/packageImport", defs: ["ScopedPackageImport", "ScopedPackageImport2"])
      `);

    const imp = result[0];
    expect(imp.from).toEqual("@scoped/packageImport");
    expect(imp.defs).toEqual(["ScopedPackageImport", "ScopedPackageImport2"]);
    expect(imp.importName).toMatchInlineSnapshot(`"atscopedpackageImport"`);
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
    expect(plain.defs).toEqual(["PackageImport", "PackageImport2"]);
    expect(plain.importName).toMatchInlineSnapshot(`"packageImport"`);
    expect(print(plain.directive)).toMatchInlineSnapshot(
      `"@import(from: \\"packageImport\\", defs: [\\"PackageImport\\", \\"PackageImport2\\"])"`,
    );
    const dir = result[1];
    expect(dir.from).toEqual("packageImport/subDir");
    expect(dir.defs).toEqual(["PackageImportSubDir"]);
    expect(dir.importName).toMatchInlineSnapshot(`"packageImportsubDir"`);
    expect(print(dir.directive)).toMatchInlineSnapshot(
      `"@import(from: \\"packageImport/subDir\\", defs: [\\"PackageImportSubDir\\"])"`,
    );
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
    expect(upDir.defs).toEqual(["UpDir"]);
    expect(upDir.importName).toMatchInlineSnapshot(`"dirUpupDir"`);
    expect(print(upDir.directive)).toMatchInlineSnapshot(
      `"@import(from: \\"../upDir\\", defs: [\\"UpDir\\"])"`,
    );
    const upUpDir = result[1];
    expect(upUpDir.from).toEqual("../../foo/bar/Dir");
    expect(upUpDir.defs).toEqual(["FooBarDir"]);
    expect(upUpDir.importName).toMatchInlineSnapshot(`"dirUpdirUpfoobarDir"`);
    expect(print(upUpDir.directive)).toMatchInlineSnapshot(
      `"@import(from: \\"../../foo/bar/Dir\\", defs: [\\"FooBarDir\\"])"`,
    );
    const loc = result[2];
    expect(loc.from).toEqual("./loc");
    expect(loc.defs).toEqual(["LocalImport"]);
    expect(loc.importName).toMatchInlineSnapshot(`".loc"`);
    expect(print(loc.directive)).toMatchInlineSnapshot(
      `"@import(from: \\"./loc\\", defs: [\\"LocalImport\\"])"`,
    );
  });
  // TODO: Error cases
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
