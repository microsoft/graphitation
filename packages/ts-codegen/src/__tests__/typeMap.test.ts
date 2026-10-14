import path from "path";
import { parse } from "graphql";
import ts from "typescript";
import { generateTS } from "..";
import type { GenerateTSOptions } from "../codegen";

const schema = `
  scalar Timestamp @model(tsType: "string", scope: "CLIENT_RESOLVERS")
  scalar Unmapped
  interface Node { id: ID! }
  enum Key_State { ACTIVE INACTIVE }
  input Key_Input { id: ID!, state: Key_State, at: Timestamp }
  type AESKey implements Node {
    id: ID!
    key: String!
    enabled: Boolean!
    count: Int!
    ratio: Float!
    at: Timestamp!
    state: Key_State!
  }
  type OneGQL_OneOnOneChatConversation { id: ID! }
  union Search_Result = AESKey | OneGQL_OneOnOneChatConversation
  type Query { key(input: Key_Input): AESKey, search: [Search_Result!]! }
  type Mutation { createKey(input: Key_Input!): AESKey! }
  type Subscription { keyChanged: AESKey! }
`;

function generate(document: string, options: Partial<GenerateTSOptions> = {}) {
  const { files } = generateTS(parse(document), {
    outputPath: __dirname,
    documentPath: path.join(__dirname, "schema.graphql"),
    legacyCompat: true,
    modelScope: "CLIENT_RESOLVERS",
    ...options,
  });
  return new Map(files.map((file) => [file.fileName, file.content]));
}

function typeMapEntries(files: Map<string, string>) {
  const legacyTypes = files.get("legacy-types.interface.ts");
  if (legacyTypes === undefined) {
    throw new Error("Missing legacy types output");
  }
  const source = ts.createSourceFile(
    "legacy-types.interface.ts",
    legacyTypes,
    ts.ScriptTarget.Latest,
    true,
  );
  const declaration = source.statements.find(
    (statement): statement is ts.TypeAliasDeclaration =>
      ts.isTypeAliasDeclaration(statement) && statement.name.text === "TypeMap",
  );
  if (!declaration || !ts.isTypeLiteralNode(declaration.type)) {
    throw new Error("TypeMap must be a closed type literal");
  }
  return Object.fromEntries(
    declaration.type.members.map((member) => {
      if (!ts.isPropertySignature(member) || !member.type) {
        throw new Error("TypeMap must contain only named properties");
      }
      return [
        ts.isStringLiteral(member.name)
          ? member.name.text
          : member.name.getText(),
        member.type.getText(),
      ];
    }),
  );
}

function expectCompiles(files: Map<string, string>, consumer: string) {
  const sources = new Map(
    [...files, ["type-map-consumer.ts", consumer]].map(([name, text]) => [
      path.resolve(__dirname, name),
      text,
    ]),
  );
  const options: ts.CompilerOptions = {
    strict: true,
    noEmit: true,
    skipLibCheck: true,
    esModuleInterop: true,
    target: ts.ScriptTarget.ES2019,
    module: ts.ModuleKind.CommonJS,
    moduleResolution: ts.ModuleResolutionKind.NodeJs,
    types: [],
    paths: {
      "@graphitation/supermassive": [
        path.resolve(__dirname, "../../../supermassive/src/index.ts"),
      ],
    },
  };
  const host = ts.createCompilerHost(options);
  const readFile = host.readFile.bind(host);
  const fileExists = host.fileExists.bind(host);
  host.readFile = (name) => sources.get(path.resolve(name)) ?? readFile(name);
  host.fileExists = (name) =>
    sources.has(path.resolve(name)) || fileExists(name);
  host.getSourceFile = (name, languageVersion) => {
    const text = host.readFile(name);
    return text === undefined
      ? undefined
      : ts.createSourceFile(name, text, languageVersion, true);
  };
  const program = ts.createProgram([...sources.keys()], options, host);
  const diagnostics = ts.getPreEmitDiagnostics(program);
  expect(
    ts.formatDiagnosticsWithColorAndContext(diagnostics, {
      getCurrentDirectory: () => __dirname,
      getCanonicalFileName: (name) => name,
      getNewLine: () => "\n",
    }),
  ).toBe("");
}

describe("legacy TypeMap generation", () => {
  it.each([false, true])(
    "maps exact schema names to emitted types (string union enums: %s)",
    (useStringUnionsInsteadOfEnums) => {
      const files = generate(schema, { useStringUnionsInsteadOfEnums });
      expect(typeMapEntries(files)).toEqual({
        AESKey: "Models.AESKey",
        Boolean: 'Scalars["Boolean"]',
        Float: 'Scalars["Float"]',
        ID: 'Scalars["ID"]',
        Int: 'Scalars["Int"]',
        Key_Input: "Models.Key_Input",
        Key_State: "Models.Key_State",
        Mutation: "Models.Mutation",
        Node: "Models.Node",
        OneGQL_OneOnOneChatConversation:
          "Models.OneGQL_OneOnOneChatConversation",
        Query: "Models.Query",
        Search_Result: "Models.Search_Result",
        String: 'Scalars["String"]',
        Subscription: "Models.Subscription",
        Timestamp: 'Scalars["Timestamp"]',
        Unmapped: 'Scalars["Unmapped"]',
      });
      expectCompiles(
        files,
        `
          import type { TypeMap, Types, Scalars } from "./legacy-types.interface";
          import type * as Models from "./models.interface";
          import type { MockResolvers } from "@graphitation/graphql-js-operation-payload-generator";
          type Equal<A, B> =
            (<T>() => T extends A ? 1 : 2) extends
            (<T>() => T extends B ? 1 : 2) ? true : false;
          type Assert<T extends true> = T;
          type Keys = Assert<Equal<keyof TypeMap,
            keyof Types | keyof Scalars | "Query" | "Mutation" | "Subscription">>;
          type ObjectModel = Assert<Equal<TypeMap["AESKey"], Models.AESKey>>;
          type InputModel = Assert<Equal<TypeMap["Key_Input"], Models.Key_Input>>;
          type EnumModel = Assert<Equal<TypeMap["Key_State"], Models.Key_State>>;
          type InterfaceModel = Assert<Equal<TypeMap["Node"], Models.Node>>;
          type UnionModel = Assert<Equal<TypeMap["Search_Result"], Models.Search_Result>>;
          type Id = Assert<Equal<TypeMap["ID"], string>>;
          type Flag = Assert<Equal<TypeMap["Boolean"], boolean>>;
          type Int = Assert<Equal<TypeMap["Int"], number>>;
          type Float = Assert<Equal<TypeMap["Float"], number>>;
          type StringScalar = Assert<Equal<TypeMap["String"], string>>;
          type Custom = Assert<Equal<TypeMap["Timestamp"], string>>;
          type UnknownScalar = Assert<Equal<TypeMap["Unmapped"], unknown>>;
          type QueryKey = Assert<Equal<TypeMap["Query"]["key"], Models.AESKey | null | undefined>>;
          type QuerySearch = Assert<Equal<TypeMap["Query"]["search"], ReadonlyArray<Models.Search_Result>>>;
          type MutationKey = Assert<Equal<TypeMap["Mutation"]["createKey"], Models.AESKey>>;
          type SubscriptionKey = Assert<Equal<TypeMap["Subscription"]["keyChanged"], Models.AESKey>>;
          // @ts-expect-error Unknown GraphQL names must not be accepted.
          type Missing = TypeMap["Missing"];
          const mocks: MockResolvers<TypeMap> = {
            AESKey: () => ({ id: "key-id", key: "secret" }),
            Boolean: () => false,
            ID: () => "id",
            Int: () => 1,
            Float: () => 1.5,
            Timestamp: () => "now",
            Query: () => ({ key: { id: "key-id" } }),
            Mutation: () => ({ createKey: { id: "new-id" } }),
            Subscription: () => ({ keyChanged: { id: "changed-id" } }),
          };
          const invalidMocks: MockResolvers<TypeMap> = {
            // @ts-expect-error Resolver keys must be exact schema names.
            Missing: () => ({}),
          };
          const invalidScalar: MockResolvers<TypeMap> = {
            // @ts-expect-error Built-in scalar values must keep their type.
            Boolean: () => "not a boolean",
          };
          const invalidModel: MockResolvers<TypeMap> = {
            // @ts-expect-error Model fields must keep their type.
            AESKey: () => ({ id: 123 }),
          };
        `,
      );
    },
  );

  it.each([
    ["no operations", "", []],
    ["only Query", "type Query { key: AESKey! }", ["Query"]],
    ["extension-only Query", "extend type Query { key: AESKey! }", ["Query"]],
    ["only Mutation", "type Mutation { key: AESKey! }", ["Mutation"]],
    [
      "only Subscription",
      "type Subscription { key: AESKey! }",
      ["Subscription"],
    ],
    [
      "explicit operation names",
      "schema { query: Client_Query } type Client_Query { key: AESKey! }",
      ["Client_Query"],
    ],
  ])("includes only supplied roots: %s", (_name, operations, roots) => {
    const files = generate(`type AESKey { id: ID! } ${operations}`);
    expect(Object.keys(typeMapEntries(files)).sort()).toEqual(
      ["AESKey", "ID", "String", "Boolean", "Int", "Float", ...roots].sort(),
    );
    expectCompiles(
      files,
      `import type { TypeMap } from "./legacy-types.interface";
       type Key = TypeMap["AESKey"];`,
    );
  });

  it("generates a model for a root-only extension document", () => {
    const files = generate("extend type Query { enabled: Boolean! }");
    expect(typeMapEntries(files).Query).toBe("Models.Query");
    expectCompiles(
      files,
      `import type { TypeMap } from "./legacy-types.interface";
       const query: TypeMap["Query"] = { enabled: true };
       // @ts-expect-error Root fields must not be any.
       const invalid: TypeMap["Query"] = { enabled: "yes" };`,
    );
  });

  it("merges model fields from definitions and extensions without duplicate keys", () => {
    const files = generate(`
      type AESKey { id: ID! }
      extend type AESKey { key: String! }
      type Query { key: AESKey! }
      extend type Query { enabled: Boolean! }
      extend type Query { count: Int! }
    `);
    expect(Object.keys(typeMapEntries(files))).toHaveLength(7);
    // Resolver declarations have their own existing extension-merging behavior;
    // this assertion covers the models and TypeMap independently.
    const modelFiles = new Map(
      [...files].filter(([name]) => !name.includes("resolvers")),
    );
    expectCompiles(
      modelFiles,
      `import type { TypeMap } from "./legacy-types.interface";
       const key: TypeMap["AESKey"] = { id: "id", key: "key" };
       const query: TypeMap["Query"] = { key, enabled: true, count: 1 };`,
    );
  });

  it("uses only @model mappings matching the requested scope", () => {
    const files = generate(schema, { modelScope: "SERVER" });
    expectCompiles(
      files,
      `import type { TypeMap } from "./legacy-types.interface";
       type Assert<T extends true> = T;
       type Unmapped = Assert<unknown extends TypeMap["Timestamp"] ? true : false>;`,
    );
  });

  it.each([false, true])(
    "preserves imported model, scalar and enum mappings (legacy object models: %s)",
    (legacyNoModelsForObjects) => {
      const files = generate(
        `
          scalar Timestamp @model(from: "./external-models", tsType: "Timestamp", scope: "CLIENT_RESOLVERS")
          enum Key_State { ACTIVE INACTIVE }
          type AESKey @model(from: "./external-models", tsType: "KeyModel", scope: "CLIENT_RESOLVERS") {
            id: ID!
          }
          type Query { key: AESKey!, at: Timestamp!, state: Key_State! }
        `,
        { enumsImport: "./external-enums", legacyNoModelsForObjects },
      );
      files.set(
        "external-models.ts",
        `export type Timestamp = Date;
         export interface KeyModel { readonly id: number; }`,
      );
      files.set(
        "external-enums.ts",
        `export enum Key_State { ACTIVE = "ACTIVE", INACTIVE = "INACTIVE" }`,
      );
      expectCompiles(
        files,
        `import type { TypeMap } from "./legacy-types.interface";
         import type { Key_State } from "./external-enums";
         type Assert<T extends true> = T;
         type CustomScalar = Assert<TypeMap["Timestamp"] extends Date ? true : false>;
         type EnumModel = Assert<TypeMap["Key_State"] extends Key_State ? true : false>;
         const id: TypeMap["AESKey"]["id"] = ${
           legacyNoModelsForObjects ? '"id"' : "123"
         };`,
      );
    },
  );

  it("excludes introspection names and handles explicitly declared built-in scalars", () => {
    const files = generate(`
      scalar ID
      scalar String
      scalar Boolean
      scalar Int
      scalar Float
      type __Hidden { id: ID! }
      type AESKey { id: ID! }
    `);
    expect(Object.keys(typeMapEntries(files))).toEqual([
      "AESKey",
      "Boolean",
      "Float",
      "ID",
      "Int",
      "String",
    ]);
    expectCompiles(
      files,
      `import type { TypeMap, Types } from "./legacy-types.interface";
       const id: TypeMap["ID"] = "id";
       const legacyId: Types["ID"] = id;`,
    );
  });

  it("does not change non-legacy or enum-only generation", () => {
    expect(
      generate(schema, { legacyCompat: false }).has(
        "legacy-types.interface.ts",
      ),
    ).toBe(false);
    expect([...generate(schema, { generateOnlyEnums: true }).keys()]).toEqual([
      "enums.interface.ts",
    ]);
  });
});
