import * as ts from "typescript";
import { createImportDocumentsTransform } from "../createImportDocumentsTransform";

import * as _fs from "fs";
const fs = _fs as jest.Mocked<typeof _fs>;

jest.mock("fs");

expect.addSnapshotSerializer({
  test: (val) => typeof val === "string",
  print: (val) => {
    return (val as string).trimRight();
  },
});

describe(createImportDocumentsTransform, () => {
  describe.each([
    [
      "es6",
      {
        target: ts.ScriptTarget.ES2015,
        module: ts.ModuleKind.ES2015,
      },
    ],
    [
      "es5",
      {
        target: ts.ScriptTarget.ES5,
        module: ts.ModuleKind.CommonJS,
      },
    ],
  ])("when emitting %s modules", (_targetName, compilerOptions) => {
    function transform(sourceText: string): string {
      return ts.transpileModule(sourceText, {
        fileName: __filename,
        transformers: { before: [createImportDocumentsTransform()] },
        compilerOptions,
      }).outputText;
    }

    it("works with documents without interpolation", () => {
      fs.existsSync.mockImplementation(() => true);
      const source = `
        const doc = graphql\`
          fragment SomeComponentFragment on Query {
            helloWorld
          }
        \`
      `;
      expect(transform(source)).toMatchSnapshot();
    });

    it("works with documents with interpolation", () => {
      fs.existsSync.mockImplementation(() => true);
      const source = `
        const doc = graphql\`
          query SomeComponentQuery($id: ID!) {
            helloWorld
            ...SomeOtherComponentFragment
          }
          \${SomeOtherComponentFragment}
        \`
      `;
      expect(transform(source)).toMatchSnapshot();
    });

    it("does not emit an import for a fragment on non-Node/Query types (for which no artefacts are emitted)", () => {
      fs.existsSync.mockImplementation(() => false);
      const source = `
      const doc = graphql\`
        fragment SomeComponentFragment on Query {
          helloWorld
        }
      \`
    `;
      expect(transform(source)).toMatchSnapshot();
    });
  });
});
