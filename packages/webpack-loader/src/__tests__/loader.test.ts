import { parse, print } from "graphql";
import { encodeASTSchema } from "@graphitation/supermassive";
import loader from "../index";

function useLoader(source: string, options: any): string {
  return loader.call({ cacheable() {}, query: options } as any, source);
}

test("basic query", () => {
  const docStr = /* GraphQL */ `
    query Foo {
      foo
    }
  `;
  const doc = useLoader(docStr, {});

  const docLine = `var doc = JSON.parse('${JSON.stringify(
    parse(docStr, { noLocation: true }),
  )}');`;
  const exportLine = `module.exports = doc`;

  expect(doc).toContain(docLine);
  expect(doc).toContain(exportLine);

  expect(doc).toMatchInlineSnapshot(`
    "
    var doc = JSON.parse('{"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"Foo"},"variableDefinitions":[],"directives":[],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"foo"},"arguments":[],"directives":[]}]}}]}');

      var names = {};
      function unique(defs) {
        return defs.filter(function (def) {
          if (def.kind !== 'FragmentDefinition') return true;
          var name = def.name.value;
          if (names[name]) {
            return false;
          } else {
            names[name] = true;
            return true;
          }
        });
      };

    module.exports = doc
    "
  `);

  // expect(doc).toBeSimilarString(`
  //   ${docLine}
  //
  //   ${uniqueCode}
  //
  //   ${exportLine}
  // `);

  // eslint-disable-next-line no-eval
  expect(print(eval(doc))).toBe(print(parse(docStr)));
});

test("basic query with esModules on", () => {
  const docStr = /* GraphQL */ `
    query Foo {
      foo
    }
  `;
  const doc = useLoader(docStr, {
    esModule: true,
  });

  const docLine = `var doc = JSON.parse('${JSON.stringify(
    parse(docStr, { noLocation: true }),
  )}');`;
  const exportLine = `export default doc`;

  expect(doc).toContain(docLine);
  expect(doc).toContain(exportLine);

  expect(doc).toMatchInlineSnapshot(`
    "
    var doc = JSON.parse('{"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"Foo"},"variableDefinitions":[],"directives":[],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"foo"},"arguments":[],"directives":[]}]}}]}');

      var names = {};
      function unique(defs) {
        return defs.filter(function (def) {
          if (def.kind !== 'FragmentDefinition') return true;
          var name = def.name.value;
          if (names[name]) {
            return false;
          } else {
            names[name] = true;
            return true;
          }
        });
      };

    export default doc
    "
  `);

  // expect(doc).toBeSimilarString(`
  //   ${docLine}
  //
  //   ${uniqueCode}
  //
  //   ${exportLine}
  // `);
});

test("supermassive encoding for SDL", () => {
  const docStr = /* GraphQL */ `
    type Query {
      foo: String
    }
  `;
  const doc = useLoader(docStr, {
    esModule: true,
    supermassiveSDL: true,
  });

  const docLine = `var doc = JSON.parse('${JSON.stringify(
    encodeASTSchema(parse(docStr, { noLocation: true })),
  )}');`;
  const exportLine = `export default doc`;

  expect(doc).toContain(docLine);
  expect(doc).toContain(exportLine);

  expect(doc).toMatchInlineSnapshot(`
    "
    var doc = JSON.parse('[{"types":{"Query":[2,{"foo":1}]}}]');

      var names = {};
      function unique(defs) {
        return defs.filter(function (def) {
          if (def.kind !== 'FragmentDefinition') return true;
          var name = def.name.value;
          if (names[name]) {
            return false;
          } else {
            names[name] = true;
            return true;
          }
        });
      };

    export default doc
    "
  `);
});

test("supermassive encoding for SDL doesn't affect operations", () => {
  const docStr = /* GraphQL */ `
    query Foo {
      foo
    }
  `;
  const doc = useLoader(docStr, {
    esModule: true,
    supermassiveSDL: true,
  });

  const docLine = `var doc = JSON.parse('${JSON.stringify(
    parse(docStr, { noLocation: true }),
  )}');`;
  const exportLine = `export default doc`;

  expect(doc).toContain(docLine);
  expect(doc).toContain(exportLine);

  expect(doc).toMatchInlineSnapshot(`
    "
    var doc = JSON.parse('{"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"Foo"},"variableDefinitions":[],"directives":[],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"foo"},"arguments":[],"directives":[]}]}}]}');

      var names = {};
      function unique(defs) {
        return defs.filter(function (def) {
          if (def.kind !== 'FragmentDefinition') return true;
          var name = def.name.value;
          if (names[name]) {
            return false;
          } else {
            names[name] = true;
            return true;
          }
        });
      };

    export default doc
    "
  `);
});

test("replaceKinds enabled", () => {
  const docStr = /* GraphQL */ `
    query Foo {
      foo
    }
  `;
  const doc = useLoader(docStr, {
    replaceKinds: true,
  });

  expect(doc).toMatch(`var Kind = require('graphql/language/kinds');`);
  expect(doc).toMatch(`"kind": Kind.DOCUMENT`);
  expect(doc).not.toMatch(`"kind": "`);
});
