import { DocumentNode, Kind, parse, print } from "graphql";
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
    expect(result.errors).toBeUndefined();
    expect(print(result.document)).toMatchInlineSnapshot(`
      "type Person implements Node {
        id: ID!
      }

      """ISO8601 Date Time"""
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

      extend type Person {
        foo: Foo
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
    expect(result.errors).toBeUndefined();
    expect(result.document.kind).toEqual(Kind.DOCUMENT);
    expect(getOutputtedSymbolNames(result.document)).toEqual([
      "@TestDirective",
      "TestInterface",
      "TestObject",
      "TestScalar",
      "@TestDirective2",
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
            @import(
              from: "@graphitation/merge-schema-testing-e2",
              defs: ["UsingDateTimeInArgs", "@testDirective"]
            )
        `,
      },
      {
        modulePath: "@graphitation/merge-schema-testing-e2",
        document: `
          extend schema
            @import(
              from: "@graphitation/merge-schema-testing-core-graphql"
              defs: ["DateTime", "Cursor", "BigInt"]
            )

          type UsingDateTimeInArgs {
            withDateTimeArg(date: DateTime): ID
          }

          type UsingBigIntInArgs {
            withDateTimeArg(bigint: BigInt): ID
          }

          directive @testDirective(cursor: Cursor) on OBJECT
        `,
      },
    ]);
    const result = await mergeSchemas(
      [{ absolutePath: "@graphitation/merge-schema-testing-e1" }],
      loader,
    );
    expect(result.errors).toBeUndefined();
    expect(result.document.kind).toEqual(Kind.DOCUMENT);
    const defs = getOutputtedSymbolNames(result.document);

    expect(defs).not.toContain("ConnectionEdge");
    expect(defs).not.toContain("UsingBigIntInArgs");
    expect(defs).not.toContain("BigInt");
    expect(defs).toEqual([
      "@testDirective",
      "UsingDateTimeInArgs",
      "Person",
      "Cursor",
      "DateTime",
      "Node",
    ]);
  });

  it("includes extensions", async () => {
    const loader = createTestModuleLoader([
      {
        modulePath: "@graphitation/merge-schema-testing-e1",
        document: `
          extend schema
            @import(
              from: "@graphitation/merge-schema-testing-core-graphql"
              defs: ["Person"]
            )
            @import(
              from: "@graphitation/merge-schema-testing-e2"
              defs: ["Presence"]
              extends: ["Bar"]
            )

          extend type Person { # include all extensions in entry point
            extendField: String
          }

          type Bar {
            id: ID!
          }

          extend type Bar { # include all extensions in entry point
            extendFieldBar: String
          }
        `,
      },
      {
        modulePath: "@graphitation/merge-schema-testing-e2",
        document: `
          extend schema
            @import(
              from: "@graphitation/merge-schema-testing-core-graphql"
              defs: ["Person", "Cursor"]
            )

            type Presence {
              id: ID!
            }

            extend type Presence { # include imported types extend
              extendPresence: Cursor
            }

            extend type Person { # don't include non imported extension
              presence: Presence
            }
        `,
      },
    ]);

    const result = await mergeSchemas(
      [{ absolutePath: "@graphitation/merge-schema-testing-e1" }],
      loader,
    );

    expect(result.errors).toBeUndefined();
    expect(result.document.kind).toEqual(Kind.DOCUMENT);
    expect(getOutputtedSymbolNames(result.document)).toEqual([
      "Bar",
      "extend Bar",
      "extend Person",
      "Presence",
      "extend Presence",
      "Person",
      "Cursor",
      "Node",
    ]);
  });

  it("imports circular imports and entry point imports", async () => {
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
    expect(result.errors).toBeUndefined();
    expect(result.document.kind).toEqual(Kind.DOCUMENT);
    expect(getOutputtedSymbolNames(result.document)).toEqual([
      "Presence",
      "User",
      "Comment",
      "Node",
    ]);
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
              from: "@graphitation/merge-schema-testing-e1"
              defs: ["Presence"],
              extends: ["User"]
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

    expect(result.document.kind).toEqual(Kind.DOCUMENT);
    expect(getOutputtedSymbolNames(result.document)).toEqual([
      "Presence",
      "extend User",
      "User",
      "Node",
    ]);
  });

  it("reports missing types for modules", async () => {
    const loader = createTestModuleLoader([
      {
        modulePath: "@graphitation/merge-schema-testing-e1",
        document: `
          extend schema
            @import(
              from: "@graphitation/merge-schema-testing-core-graphql"
              defs: ["Nodeee"] # Incorrect import
            )
            @import(
              from: "@graphitation/merge-schema-testing-e2"
              defs: ["User"]
            )
            @import(
              from: "@graphitation/this-module-does-not-exist",
              defs: ["Froobar"]
            )

          type Presence implements Node { # not imported import
            id: ID!
            user: User
          }

          extend type User {
            presence: Presence # not imported
          }
        `,
      },
      {
        modulePath: "@graphitation/merge-schema-testing-e2",
        document: `
            type User implements Node { # missing import implement
              id: ID!
              comment: Comment # missing import
            }
        `,
      },
    ]);

    const result = await mergeSchemas(
      [{ absolutePath: "@graphitation/merge-schema-testing-e1" }],
      loader,
    );
    // Fix for jest's problem with circular objects
    const errors = result.errors?.map((e) => ({
      ...e,
      forType: e.forType
        ? {
            module: e.forType.module,
          }
        : undefined,
    }));
    expect(errors).toEqual([
      {
        forType: {
          module: "@graphitation/merge-schema-testing-e1",
        },
        isEntryPoint: false,
        isExtension: false,
        module: "@graphitation/merge-schema-testing-core-graphql",
        name: "Nodeee",
      },
      {
        forType: {
          module: "@graphitation/merge-schema-testing-e1",
        },
        isEntryPoint: true,
        isExtension: false,
        module: "@graphitation/merge-schema-testing-e1",
        name: "Node",
      },
      {
        forType: {
          module: "@graphitation/merge-schema-testing-e2",
        },
        isEntryPoint: false,
        isExtension: false,
        module: "@graphitation/merge-schema-testing-e2",
        name: "Node",
      },
      {
        forType: {
          module: "@graphitation/merge-schema-testing-e2",
        },
        isEntryPoint: false,
        isExtension: false,
        module: "@graphitation/merge-schema-testing-e2",
        name: "Comment",
      },
      {
        forType: {
          module: "@graphitation/merge-schema-testing-e1",
        },
        isEntryPoint: false,
        isExtension: false,
        module: "@graphitation/this-module-does-not-exist",
        name: "Froobar",
      },
    ]);
  });
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

function getOutputtedSymbolNames(document: DocumentNode) {
  return document.definitions.map((def) => {
    if ("name" in def) {
      if (def.kind === Kind.OBJECT_TYPE_EXTENSION) {
        return `extend ${def.name.value}`;
      } else if (def.kind === Kind.DIRECTIVE_DEFINITION) {
        return `@${def.name.value}`;
      } else {
        return def.name?.value;
      }
    } else {
      return def;
    }
  });
}
