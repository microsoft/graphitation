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
        AESKey: expect.stringContaining('readonly id: TypeMap["ID"];'),
        Boolean: 'Scalars["Boolean"]',
        Float: 'Scalars["Float"]',
        ID: 'Scalars["ID"]',
        Int: 'Scalars["Int"]',
        Key_Input: "Models.Key_Input",
        Key_State: "Models.Key_State",
        Mutation: expect.stringContaining(
          'readonly createKey: TypeMap["AESKey"];',
        ),
        Node: expect.stringContaining('readonly id: TypeMap["ID"];'),
        OneGQL_OneOnOneChatConversation: expect.stringContaining(
          'readonly id: TypeMap["ID"];',
        ),
        Query: expect.stringContaining(
          'readonly key?: TypeMap["AESKey"] | null;',
        ),
        Search_Result:
          'TypeMap["AESKey"] | TypeMap["OneGQL_OneOnOneChatConversation"]',
        String: 'Scalars["String"]',
        Subscription: expect.stringContaining(
          'readonly keyChanged: TypeMap["AESKey"];',
        ),
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
          type ObjectId = Assert<Equal<TypeMap["AESKey"]["id"], string>>;
          type InputModel = Assert<Equal<TypeMap["Key_Input"], Models.Key_Input>>;
          type EnumModel = Assert<Equal<TypeMap["Key_State"], Models.Key_State>>;
          type InterfaceId = Assert<Equal<TypeMap["Node"]["id"], string>>;
          type UnionPayload = Assert<Equal<TypeMap["Search_Result"],
            TypeMap["AESKey"] | TypeMap["OneGQL_OneOnOneChatConversation"]>>;
          type Id = Assert<Equal<TypeMap["ID"], string>>;
          type Flag = Assert<Equal<TypeMap["Boolean"], boolean>>;
          type Int = Assert<Equal<TypeMap["Int"], number>>;
          type Float = Assert<Equal<TypeMap["Float"], number>>;
          type StringScalar = Assert<Equal<TypeMap["String"], string>>;
          type Custom = Assert<Equal<TypeMap["Timestamp"], string>>;
          type UnknownScalar = Assert<Equal<TypeMap["Unmapped"], unknown>>;
          type QueryKey = Assert<Equal<TypeMap["Query"]["key"], TypeMap["AESKey"] | null | undefined>>;
          type QuerySearch = Assert<Equal<TypeMap["Query"]["search"], ReadonlyArray<TypeMap["Search_Result"]>>>;
          type MutationKey = Assert<Equal<TypeMap["Mutation"]["createKey"], TypeMap["AESKey"]>>;
          type SubscriptionKey = Assert<Equal<TypeMap["Subscription"]["keyChanged"], TypeMap["AESKey"]>>;
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
    [false, false],
    [false, true],
    [true, false],
    [true, true],
  ])(
    "keeps public interface and root payloads strict (legacy object models: %s, string union enums: %s)",
    (legacyNoModelsForObjects, useStringUnionsInsteadOfEnums) => {
      const files = generate(
        `
          scalar Timestamp @model(tsType: "string", scope: "CLIENT_RESOLVERS")
          interface Entity { id: ID! }
          interface BaseConversation implements Entity {
            id: ID!
            title: String!
            internalId: Int
          }
          enum State { ACTIVE INACTIVE }
          type Conversation implements Entity & BaseConversation
            @model(from: "./external-models", tsType: "ConversationModel", scope: "CLIENT_RESOLVERS") {
            id: ID!
            title: String!
            internalId: Int
            state: State!
            at: Timestamp!
            related: BaseConversation
          }
          type Query {
            conversation: BaseConversation
            concrete: Conversation!
            conversations: [BaseConversation!]!
            nullableConversations: [BaseConversation]
            matrix: [[Int!]!]
            enabled: Boolean!
          }
        `,
        { legacyNoModelsForObjects, useStringUnionsInsteadOfEnums },
      );
      files.set(
        "external-models.ts",
        `export interface ConversationModel {
          readonly id: number;
          readonly title: number;
        }`,
      );
      expect(files.get("models.interface.ts")).toContain(
        "export interface BaseConversation extends BaseModel, Entity {\n    readonly __typename?: string;\n}",
      );
      expectCompiles(
        files,
        `
          import type { TypeMap } from "./legacy-types.interface";
          import type * as Models from "./models.interface";
          import type { MockResolvers } from "@graphitation/graphql-js-operation-payload-generator";
          type Equal<A, B> =
            (<T>() => T extends A ? 1 : 2) extends
            (<T>() => T extends B ? 1 : 2) ? true : false;
          type Assert<T extends true> = T;
          type Id = Assert<Equal<TypeMap["BaseConversation"]["id"], string>>;
          type Title = Assert<Equal<TypeMap["BaseConversation"]["title"], string>>;
          type Nullable = Assert<Equal<TypeMap["BaseConversation"]["internalId"], number | null | undefined>>;
          type List = Assert<Equal<TypeMap["Query"]["conversations"], ReadonlyArray<TypeMap["BaseConversation"]>>>;
          type NullableList = Assert<Equal<TypeMap["Query"]["nullableConversations"], ReadonlyArray<TypeMap["BaseConversation"] | null> | null | undefined>>;
          type Matrix = Assert<Equal<TypeMap["Query"]["matrix"], ReadonlyArray<ReadonlyArray<number>> | null | undefined>>;
          type Scalar = Assert<Equal<TypeMap["Conversation"]["at"], string>>;
          type ModelId = Assert<Equal<Models.Conversation["id"], ${
            legacyNoModelsForObjects ? "string" : "number"
          }>>;
          declare const state: TypeMap["State"];
          const mocks: MockResolvers<TypeMap> = {
            BaseConversation: () => ({ id: "channel-id", title: "Channel Name" }),
            Conversation: () => ({ id: "channel-id", state }),
            Query: () => ({
              conversation: { title: "Channel Name" },
              concrete: { id: "id", related: { title: "Related" } },
              conversations: [{ id: "id" }],
              matrix: [[1, 2]],
              enabled: false,
            }),
          };
          const partialMocks: MockResolvers<TypeMap> = {
            BaseConversation: () => ({ title: "Channel Name" }),
            Query: () => ({
              conversation: null,
              nullableConversations: [null, { id: "id" }],
              matrix: null,
            }),
          };
          const invalidId: MockResolvers<TypeMap> = {
            // @ts-expect-error Interface fields must be checked within root payloads.
            Query: () => ({ conversation: { id: 123 } }),
          };
          const invalidTitle: MockResolvers<TypeMap> = {
            // @ts-expect-error Do not substitute the server model's number for String.
            Query: () => ({ concrete: { title: 123 } }),
          };
          const invalidList: MockResolvers<TypeMap> = {
            // @ts-expect-error Lists must retain their item types.
            Query: () => ({ conversations: [{ title: 123 }] }),
          };
          const invalidBoolean: MockResolvers<TypeMap> = {
            // @ts-expect-error Root scalar fields must retain their types.
            Query: () => ({ enabled: "yes" }),
          };
          const invalidEnum: MockResolvers<TypeMap> = {
            // @ts-expect-error Enum fields must reject unknown values.
            Query: () => ({ concrete: { state: "INVALID" } }),
          };
          // @ts-expect-error Non-null list items must reject null.
          const invalidNull: TypeMap["Query"]["conversations"] = [null];
          // @ts-expect-error Nested non-null lists must reject null.
          const invalidMatrix: TypeMap["Query"]["matrix"] = [null];
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
    expect(typeMapEntries(files).Query).toContain(
      'readonly enabled: TypeMap["Boolean"];',
    );
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

  it("keeps references to types imported from another schema module", () => {
    const files = generate(`
      extend schema @import(from: "./external-schema", defs: ["Avatar"])
      interface Node { id: ID! }
      type User implements Node { id: ID!, avatar: Avatar }
      type Query { user: User! }
    `);
    files.set(
      "external-schema.ts",
      `export namespace models {
        export interface Avatar { readonly url: string; }
      }`,
    );
    expectCompiles(
      files,
      `import type { TypeMap } from "./legacy-types.interface";
       const user: TypeMap["User"] = { id: "id", avatar: { url: "url" } };
       // @ts-expect-error Imported fields retain their declared types.
       const invalid: TypeMap["User"] = { id: "id", avatar: { url: 123 } };`,
    );
  });

  it.each([false, true])(
    "preserves scalar and enum mappings without substituting object models (legacy object models: %s)",
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
         import type * as Models from "./models.interface";
         import type { Key_State } from "./external-enums";
         type Assert<T extends true> = T;
         type CustomScalar = Assert<TypeMap["Timestamp"] extends Date ? true : false>;
         type EnumModel = Assert<TypeMap["Key_State"] extends Key_State ? true : false>;
         const id: TypeMap["AESKey"]["id"] = "id";
         const modelId: Models.AESKey["id"] = ${
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
