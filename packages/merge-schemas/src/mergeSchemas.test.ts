import { Kind, parse, print } from "graphql";
import { mergeSchemas } from "./mergeSchemas";
import path from "path";
import {
  FileSystemModuleLoader,
  ModuleLoader,
  TestModuleLoader,
} from "./moduleLoader";

describe(mergeSchemas, () => {
  it("integration", async () => {
    const entryPointPath = path.resolve(
      __dirname,
      "./__tests__/fixtures/entry-point.graphql",
    );
    const result = await mergeSchemas(
      [
        {
          absolutePath: entryPointPath,
        },
      ],
      new FileSystemModuleLoader(),
    );
    expect(print(result)).toMatchInlineSnapshot(`
      """"ISO8601 Date Time"""
      scalar DateTime

      """
      Define a type to be compliant with the Global Object Identification best-practice spec.
      https://graphql.org/learn/global-object-identification/
      """
      interface Node {
        id: ID!
      }

      type Baz implements Node {
        id: ID!
        foo: Foo
      }

      type Bar implements Node {
        id: ID!
      }

      type Foo implements Node {
        id: ID!
        timestamp: DateTime
      }
      "
    `);
  });

  it("includes all types defined and imported at entry points", async () => {
    const loader = createTestModuleLoader([
      {
        modulePath: "@graphitation/merge-schema-testing-e1",
        document: `
          extend schema
            @import(
              from: "@graphitation/merge-schema-testing-core-graphql"
              defs: ["Node", "Person"]
            )

          scalar TestScalar

          directive @TestDirective on OBJECT

          interface TestInterface implements Node {
            testField: TestScalar
          }

          type TestObject {
            id: ID!
          }
        `,
      },
      {
        modulePath: "@graphitation/merge-schema-testing-e2",
        document: `
          scalar TestScalar2

          directive @TestDirective2 on OBJECT

          interface TestInterface2 {
            testField: TestScalar2
          }

          type TestObject2 {
            id: ID!
          }
        `,
      },
    ]);
    const result = await mergeSchemas(
      [
        { absolutePath: "@graphitation/merge-schema-testing-e1" },
        { absolutePath: "@graphitation/merge-schema-testing-e2" },
      ],
      loader,
    );
    expect(result.kind).toEqual(Kind.DOCUMENT);
    expect(
      result.definitions.map((def) => {
        if ("name" in def) {
          return def.name?.value;
        } else {
          return def;
        }
      }),
    ).toEqual([
      "TestDirective",
      "TestInterface",
      "TestObject",
      "TestScalar",
      "TestDirective2",
      "TestInterface2",
      "TestObject2",
      "TestScalar2",
      "Person",
      "Node",
    ]);
  });

  it("includes only required types from other files", async () => {
    const loader = createTestModuleLoader([
      {
        modulePath: "@graphitation/merge-schema-testing-e1",
        document: `
          extend schema
            @import(
              from: "@graphitation/merge-schema-testing-core-graphql"
              defs: ["Person"]
            )
        `,
      },
    ]);
    const result = await mergeSchemas(
      [{ absolutePath: "@graphitation/merge-schema-testing-e1" }],
      loader,
    );
    expect(result.kind).toEqual(Kind.DOCUMENT);
    const defs = result.definitions.map((def) => {
      if ("name" in def) {
        return def.name?.value;
      } else {
        return def;
      }
    });
    expect(defs).not.toContain("ConnectionEdge");
    expect(defs).toEqual(["Person", "Node"]);
  });

  it("handles circular imports and entry point imports", async () => {
    const loader = createTestModuleLoader([
      {
        modulePath: "@graphitation/merge-schema-testing-e1",
        document: `
          extend schema
            @import(
              from: "@graphitation/merge-schema-testing-core-graphql"
              defs: ["Node"]
            )
            @import(
              from: "@graphitation/merge-schema-testing-e2"
              defs: ["User"]
            )

          type Presence implements Node {
            id: ID!
            user: User
          }
        `,
      },
      {
        modulePath: "@graphitation/merge-schema-testing-e2",
        document: `
          extend schema
            @import(
              from: "@graphitation/merge-schema-testing-core-graphql"
              defs: ["Node"]
            )
            @import(
              from: "@graphitation/merge-schema-testing-e2"
              defs: ["Presence"]
            )
            @import(
              from: "@graphitation/merge-schema-testing-e3"
              defs: ["Comment"]
            )

          type User implements Node {
            id: ID!
            presence: Presence
            comments: [Comment]
          }
        `,
      },
      {
        modulePath: "@graphitation/merge-schema-testing-e3",
        document: `
          extend schema
            @import(
              from: "@graphitation/merge-schema-testing-core-graphql"
              defs: ["Node"]
            )
            @import(
              from: "@graphitation/merge-schema-testing-e2"
              defs: ["User"]
            )

          type Comment implements Node {
            id: ID!
            user: User
          }
        `,
      },
    ]);
    const result = await mergeSchemas(
      [
        { absolutePath: "@graphitation/merge-schema-testing-e1" },
        { absolutePath: "@graphitation/merge-schema-testing-e2" },
      ],
      loader,
    );

    expect(result.kind).toEqual(Kind.DOCUMENT);
    expect(
      result.definitions.map((def) => {
        if ("name" in def) {
          return def.name?.value;
        } else {
          return def;
        }
      }),
    ).toEqual(["Presence", "User", "Comment", "Node"]);
  });

  it("includes extends for all used types in imported modules", async () => {
    const loader = createTestModuleLoader([
      {
        modulePath: "@graphitation/merge-schema-testing-e1",
        document: `
          extend schema
            @import(
              from: "@graphitation/merge-schema-testing-core-graphql"
              defs: ["Node"]
            )
            @import(
              from: "@graphitation/merge-schema-testing-e2"
              defs: ["User"]
            )

          type Presence implements Node {
            id: ID!
            user: User
          }

          extend type User {
            presence: Presence
          }
        `,
      },
      {
        modulePath: "@graphitation/merge-schema-testing-e2",
        document: `
          extend schema
            @import(
              from: "@graphitation/merge-schema-testing-e2"
              defs: ["Presence"]
            )

          type User implements Node {
            id: ID!
          }
        `,
      },
    ]);

    const result = await mergeSchemas(
      [{ absolutePath: "@graphitation/merge-schema-testing-e2" }],
      loader,
    );

    expect(result.kind).toEqual(Kind.DOCUMENT);
    expect(
      result.definitions.map((def) => {
        if ("name" in def) {
          if (def.kind === Kind.OBJECT_TYPE_EXTENSION) {
            return `extend ${def.name.value}`;
          } else {
            return def.name?.value;
          }
        } else {
          return def;
        }
      }),
    ).toEqual(["Presence", "extend User", "User", "Node"]);
  });

  // it("reports missing types for modules")
  // it("ignores missing types in entry points with a flag")
});

function createTestModuleLoader(
  entryPoints: Array<{ modulePath: string; document: string }>,
): ModuleLoader {
  const moduleMap = new Map();
  for (const { modulePath, document } of entryPoints) {
    moduleMap.set(modulePath, {
      rootPath: modulePath,
      document: parse(document),
    });
  }
  return new TestModuleLoader(moduleMap);
}
