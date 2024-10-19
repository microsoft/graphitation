import ts from "typescript";
import { parse } from "graphql";
import { blankGraphQLTag as graphql } from "../utilities";
import { generateTS } from "..";

describe(generateTS, () => {
  describe("Tests basic syntax GraphQL syntax", () => {
    test("all possible nullable and non-nullable combinations", () => {
      const { resolvers, models, enums, inputs } = runGenerateTest(graphql`
        extend schema @import(from: "@msteams/packages-test", defs: ["Avatar"])
        type Post @model(from: "./post-model.interface", tsType: "PostModel") {
          id: ID!
        }

        type Message {
          id: ID! @context(uses: ["MessageStateMachine"])
        }

        type User @context(uses: ["UserStateMachine"]) {
          id: ID! @context(uses: ["IdUserStateMachine"])
          name: String
          messagesWithAnswersNonRequired: [[Message]]
          messagesWithAnswersRequired: [[Message]]!
          messagesWithAnswersAllRequired: [[Message!]!]!
          messagesNonRequired: [Message]
          messagesWithArrayRequired: [Message]!
          messagesRequired: [Message!]!
          messagesOnlyMessageRequired: [Message!]
          post: Post @context(uses: ["PostStateMachine"])
          postRequired: Post!
          avatar: Avatar
          avatarRequired: Avatar!
        }

        extend type Query {
          requiredUsers: [User!]!
          optionalUsers: [User]
          optionalUser: User
          requiredUser: User!
          requiredPost: Post!
          optionalPost: Post
        }
      `);
      expect(enums).toMatchInlineSnapshot(`undefined`);
      expect(inputs).toMatchInlineSnapshot(`undefined`);
      expect(models).toMatchInlineSnapshot(`
        "import type { Avatar } from "@msteams/packages-test";
        import type { PostModel as _Post } from "../post-model.interface";
        // Base type for all models. Enables automatic resolution of abstract GraphQL types (interfaces, unions)
        export interface BaseModel {
            readonly __typename?: string;
        }
        export interface Post extends BaseModel, _Post {
            readonly __typename?: "Post";
        }
        export interface Message extends BaseModel {
            readonly __typename?: "Message";
            readonly id: string;
        }
        export interface User extends BaseModel {
            readonly __typename?: "User";
            readonly id: string;
            readonly name?: string | null;
            readonly messagesWithAnswersNonRequired?: ReadonlyArray<ReadonlyArray<Message | null> | null> | null;
            readonly messagesWithAnswersRequired: ReadonlyArray<ReadonlyArray<Message | null> | null>;
            readonly messagesWithAnswersAllRequired: ReadonlyArray<ReadonlyArray<Message>>;
            readonly messagesNonRequired?: ReadonlyArray<Message | null> | null;
            readonly messagesWithArrayRequired: ReadonlyArray<Message | null>;
            readonly messagesRequired: ReadonlyArray<Message>;
            readonly messagesOnlyMessageRequired?: ReadonlyArray<Message> | null;
            readonly post?: Post | null;
            readonly postRequired: Post;
            readonly avatar?: Avatar | null;
            readonly avatarRequired: Avatar;
        }
        "
      `);
      expect(resolvers).toMatchInlineSnapshot(`
        "import type { Avatar } from "@msteams/packages-test";
        import type { PromiseOrValue } from "@graphitation/supermassive";
        import type { ResolveInfo } from "@graphitation/supermassive";
        import * as Models from "./models.interface";
        import type { CoreContext } from "core-context";
        import type { MessageStateMachine } from "id-state-machine";
        import type { UserStateMachine } from "User-state-machine";
        import type { IdUserStateMachine } from "id-state-machine";
        import type { PostStateMachine } from "post-state-machine";
        export declare namespace Post {
            export interface Resolvers {
                readonly id?: id;
            }
            export type id = (model: Models.Post, args: {}, context: PostStateMachine, info: ResolveInfo) => PromiseOrValue<string>;
        }
        export declare namespace Message {
            export interface Resolvers {
                readonly id?: id;
            }
            export type id = (model: Models.Message, args: {}, context: MessageStateMachine, info: ResolveInfo) => PromiseOrValue<string>;
        }
        export declare namespace User {
            export interface Resolvers {
                readonly id?: id;
                readonly name?: name;
                readonly messagesWithAnswersNonRequired?: messagesWithAnswersNonRequired;
                readonly messagesWithAnswersRequired?: messagesWithAnswersRequired;
                readonly messagesWithAnswersAllRequired?: messagesWithAnswersAllRequired;
                readonly messagesNonRequired?: messagesNonRequired;
                readonly messagesWithArrayRequired?: messagesWithArrayRequired;
                readonly messagesRequired?: messagesRequired;
                readonly messagesOnlyMessageRequired?: messagesOnlyMessageRequired;
                readonly post?: post;
                readonly postRequired?: postRequired;
                readonly avatar?: avatar;
                readonly avatarRequired?: avatarRequired;
            }
            export type id = (model: Models.User, args: {}, context: IdUserStateMachine, info: ResolveInfo) => PromiseOrValue<string>;
            export type name = (model: Models.User, args: {}, context: UserStateMachine, info: ResolveInfo) => PromiseOrValue<string | null | undefined>;
            export type messagesWithAnswersNonRequired = (model: Models.User, args: {}, context: UserStateMachine, info: ResolveInfo) => PromiseOrValue<ReadonlyArray<ReadonlyArray<Models.Message | null | undefined> | null | undefined> | null | undefined>;
            export type messagesWithAnswersRequired = (model: Models.User, args: {}, context: UserStateMachine, info: ResolveInfo) => PromiseOrValue<ReadonlyArray<ReadonlyArray<Models.Message | null | undefined> | null | undefined>>;
            export type messagesWithAnswersAllRequired = (model: Models.User, args: {}, context: UserStateMachine, info: ResolveInfo) => PromiseOrValue<ReadonlyArray<ReadonlyArray<Models.Message>>>;
            export type messagesNonRequired = (model: Models.User, args: {}, context: UserStateMachine, info: ResolveInfo) => PromiseOrValue<ReadonlyArray<Models.Message | null | undefined> | null | undefined>;
            export type messagesWithArrayRequired = (model: Models.User, args: {}, context: UserStateMachine, info: ResolveInfo) => PromiseOrValue<ReadonlyArray<Models.Message | null | undefined>>;
            export type messagesRequired = (model: Models.User, args: {}, context: UserStateMachine, info: ResolveInfo) => PromiseOrValue<ReadonlyArray<Models.Message>>;
            export type messagesOnlyMessageRequired = (model: Models.User, args: {}, context: UserStateMachine, info: ResolveInfo) => PromiseOrValue<ReadonlyArray<Models.Message> | null | undefined>;
            export type post = (model: Models.User, args: {}, context: PostStateMachine, info: ResolveInfo) => PromiseOrValue<Models.Post | null | undefined>;
            export type postRequired = (model: Models.User, args: {}, context: UserStateMachine, info: ResolveInfo) => PromiseOrValue<Models.Post>;
            export type avatar = (model: Models.User, args: {}, context: UserStateMachine, info: ResolveInfo) => PromiseOrValue<Avatar | null | undefined>;
            export type avatarRequired = (model: Models.User, args: {}, context: UserStateMachine, info: ResolveInfo) => PromiseOrValue<Avatar>;
        }
        export declare namespace Query {
            export interface Resolvers {
                readonly requiredUsers?: requiredUsers;
                readonly optionalUsers?: optionalUsers;
                readonly optionalUser?: optionalUser;
                readonly requiredUser?: requiredUser;
                readonly requiredPost?: requiredPost;
                readonly optionalPost?: optionalPost;
            }
            export type requiredUsers = (model: unknown, args: {}, context: UserStateMachine, info: ResolveInfo) => PromiseOrValue<ReadonlyArray<Models.User>>;
            export type optionalUsers = (model: unknown, args: {}, context: UserStateMachine, info: ResolveInfo) => PromiseOrValue<ReadonlyArray<Models.User | null | undefined> | null | undefined>;
            export type optionalUser = (model: unknown, args: {}, context: UserStateMachine, info: ResolveInfo) => PromiseOrValue<Models.User | null | undefined>;
            export type requiredUser = (model: unknown, args: {}, context: UserStateMachine, info: ResolveInfo) => PromiseOrValue<Models.User>;
            export type requiredPost = (model: unknown, args: {}, context: PostStateMachine, info: ResolveInfo) => PromiseOrValue<Models.Post>;
            export type optionalPost = (model: unknown, args: {}, context: PostStateMachine, info: ResolveInfo) => PromiseOrValue<Models.Post | null | undefined>;
        }
        "
      `);
    });
    test("Subscription", () => {
      const { resolvers, models, enums, inputs } = runGenerateTest(graphql`
        type User {
          id: ID!
        }

        extend type Subscription {
          userUpdated: User!
        }
      `);
      expect(enums).toMatchInlineSnapshot(`undefined`);
      expect(inputs).toMatchInlineSnapshot(`undefined`);
      expect(models).toMatchInlineSnapshot(`
        "// Base type for all models. Enables automatic resolution of abstract GraphQL types (interfaces, unions)
        export interface BaseModel {
            readonly __typename?: string;
        }
        export interface User extends BaseModel {
            readonly __typename?: "User";
            readonly id: string;
        }
        "
      `);
      expect(resolvers).toMatchInlineSnapshot(`
        "import type { PromiseOrValue } from "@graphitation/supermassive";
        import type { ResolveInfo } from "@graphitation/supermassive";
        import * as Models from "./models.interface";
        export declare namespace User {
            export interface Resolvers {
                readonly id?: id;
            }
            export type id = (model: Models.User, args: {}, context: unknown, info: ResolveInfo) => PromiseOrValue<string>;
        }
        export declare namespace Subscription {
            export interface Resolvers {
                readonly userUpdated?: userUpdated<any>;
            }
            export type userUpdated<SubscribeResult = never> = {
                subscribe: (model: unknown, args: {}, context: unknown, info: ResolveInfo) => PromiseOrValue<AsyncIterator<{
                    userUpdated: Models.User;
                }>>;
            } | {
                subscribe: (model: unknown, args: {}, context: unknown, info: ResolveInfo) => PromiseOrValue<AsyncIterator<SubscribeResult>>;
                resolve: (subcribeResult: SubscribeResult, args: {}, context: unknown, info: ResolveInfo) => PromiseOrValue<Models.User>;
            };
        }
        "
      `);
    });
    test("Subscription with model", () => {
      const { resolvers } = runGenerateTest(graphql`
        type User @model(from: "./user-model.interface", tsType: "UserModel") {
          id: ID!
        }

        extend type Subscription {
          userUpdated: User!
        }
      `);
      expect(resolvers).toMatchInlineSnapshot(`
        "import type { PromiseOrValue } from "@graphitation/supermassive";
        import type { ResolveInfo } from "@graphitation/supermassive";
        import * as Models from "./models.interface";
        export declare namespace User {
            export interface Resolvers {
                readonly id?: id;
            }
            export type id = (model: Models.User, args: {}, context: unknown, info: ResolveInfo) => PromiseOrValue<string>;
        }
        export declare namespace Subscription {
            export interface Resolvers {
                readonly userUpdated?: userUpdated<any>;
            }
            export type userUpdated<SubscribeResult = never> = {
                subscribe: (model: unknown, args: {}, context: unknown, info: ResolveInfo) => PromiseOrValue<AsyncIterator<{
                    userUpdated: Models.User;
                }>>;
            } | {
                subscribe: (model: unknown, args: {}, context: unknown, info: ResolveInfo) => PromiseOrValue<AsyncIterator<SubscribeResult>>;
                resolve: (subcribeResult: SubscribeResult, args: {}, context: unknown, info: ResolveInfo) => PromiseOrValue<Models.User>;
            };
        }
        "
      `);
    });
    test("extends by exteding a type with pre-generated BaseModel type", () => {
      const { resolvers, models, enums, inputs } = runGenerateTest(graphql`
        type User {
          id: ID!
        }

        extend type Query {
          users: [User!]!
        }
      `);
      expect(enums).toMatchInlineSnapshot(`undefined`);
      expect(inputs).toMatchInlineSnapshot(`undefined`);
      expect(models).toMatchInlineSnapshot(`
        "// Base type for all models. Enables automatic resolution of abstract GraphQL types (interfaces, unions)
        export interface BaseModel {
            readonly __typename?: string;
        }
        export interface User extends BaseModel {
            readonly __typename?: "User";
            readonly id: string;
        }
        "
      `);
      expect(resolvers).toMatchInlineSnapshot(`
        "import type { PromiseOrValue } from "@graphitation/supermassive";
        import type { ResolveInfo } from "@graphitation/supermassive";
        import * as Models from "./models.interface";
        export declare namespace User {
            export interface Resolvers {
                readonly id?: id;
            }
            export type id = (model: Models.User, args: {}, context: unknown, info: ResolveInfo) => PromiseOrValue<string>;
        }
        export declare namespace Query {
            export interface Resolvers {
                readonly users?: users;
            }
            export type users = (model: unknown, args: {}, context: unknown, info: ResolveInfo) => PromiseOrValue<ReadonlyArray<Models.User>>;
        }
        "
      `);
    });
    test("case when interface implements multiple interfaces", () => {
      const { resolvers, models, enums, inputs } = runGenerateTest(graphql`
        interface Node @context(uses: ["NodeStateMachine"]) {
          id: ID!
        }

        interface Persona @context(uses: ["PersonaStateMachine"]) {
          phone: String!
        }

        interface User implements Node & Persona {
          id: ID!
          name: String!
        }

        type Admin implements Node & Persona
          @context(uses: ["AdminStateMachine"]) {
          id: ID!
          rank: Int!
        }

        extend type Query {
          users: [User]
          admins: [Admin]
        }
      `);
      expect(enums).toMatchInlineSnapshot(`undefined`);
      expect(inputs).toMatchInlineSnapshot(`undefined`);
      expect(models).toMatchInlineSnapshot(`
        "// Base type for all models. Enables automatic resolution of abstract GraphQL types (interfaces, unions)
        export interface BaseModel {
            readonly __typename?: string;
        }
        export interface Node extends BaseModel {
            readonly __typename?: string;
        }
        export interface Persona extends BaseModel {
            readonly __typename?: string;
        }
        export interface User extends BaseModel, Node, Persona {
            readonly __typename?: string;
        }
        export interface Admin extends BaseModel, Node, Persona {
            readonly __typename?: "Admin";
            readonly id: string;
            readonly rank: number;
        }
        "
      `);
      expect(resolvers).toMatchInlineSnapshot(`
        "import type { PromiseOrValue } from "@graphitation/supermassive";
        import type { ResolveInfo } from "@graphitation/supermassive";
        import * as Models from "./models.interface";
        import type { CoreContext } from "core-context";
        import type { NodeStateMachine } from "Node-state-machine";
        import type { PersonaStateMachine } from "Persona-state-machine";
        import type { AdminStateMachine } from "Admin-state-machine";
        export declare namespace Node {
            export interface Resolvers {
                readonly __resolveType?: __resolveType;
            }
            export type __resolveType = (parent: unknown, context: unknown, info: ResolveInfo) => PromiseOrValue<string | null>;
        }
        export declare namespace Persona {
            export interface Resolvers {
                readonly __resolveType?: __resolveType;
            }
            export type __resolveType = (parent: unknown, context: unknown, info: ResolveInfo) => PromiseOrValue<string | null>;
        }
        export declare namespace User {
            export interface Resolvers {
                readonly __resolveType?: __resolveType;
            }
            export type __resolveType = (parent: unknown, context: unknown, info: ResolveInfo) => PromiseOrValue<string | null>;
        }
        export declare namespace Admin {
            export interface Resolvers {
                readonly id?: id;
                readonly rank?: rank;
            }
            export type id = (model: Models.Admin, args: {}, context: AdminStateMachine, info: ResolveInfo) => PromiseOrValue<string>;
            export type rank = (model: Models.Admin, args: {}, context: AdminStateMachine, info: ResolveInfo) => PromiseOrValue<number>;
        }
        export declare namespace Query {
            export interface Resolvers {
                readonly users?: users;
                readonly admins?: admins;
            }
            export type users = (model: unknown, args: {}, context: unknown, info: ResolveInfo) => PromiseOrValue<ReadonlyArray<Models.User | null | undefined> | null | undefined>;
            export type admins = (model: unknown, args: {}, context: AdminStateMachine, info: ResolveInfo) => PromiseOrValue<ReadonlyArray<Models.Admin | null | undefined> | null | undefined>;
        }
        "
      `);
    });
    test("extensions are not generated in the models", () => {
      const { models } = runGenerateTest(graphql`
        extend schema @import(from: "@msteams/packages-test", defs: ["User"])

        extend type User {
          id: ID!
          name: String!
        }

        type Post {
          id: ID!
          user: User!
        }
      `);
      expect(models).toMatchInlineSnapshot(`
        "import type { User } from "@msteams/packages-test";
        // Base type for all models. Enables automatic resolution of abstract GraphQL types (interfaces, unions)
        export interface BaseModel {
            readonly __typename?: string;
        }
        export interface Post extends BaseModel {
            readonly __typename?: "Post";
            readonly id: string;
            readonly user: User;
        }
        "
      `);
    });

    test("implements", () => {
      const { resolvers, models, enums, inputs } = runGenerateTest(graphql`
        interface Node @context(uses: ["NodeStateMachine"]) {
          id: ID!
        }

        type User implements Node {
          id: ID!
          name: String!
        }

        extend type Query {
          users: [User]
        }
      `);
      expect(enums).toMatchInlineSnapshot(`undefined`);
      expect(inputs).toMatchInlineSnapshot(`undefined`);
      expect(models).toMatchInlineSnapshot(`
        "// Base type for all models. Enables automatic resolution of abstract GraphQL types (interfaces, unions)
        export interface BaseModel {
            readonly __typename?: string;
        }
        export interface Node extends BaseModel {
            readonly __typename?: string;
        }
        export interface User extends BaseModel, Node {
            readonly __typename?: "User";
            readonly id: string;
            readonly name: string;
        }
        "
      `);
      expect(resolvers).toMatchInlineSnapshot(`
        "import type { PromiseOrValue } from "@graphitation/supermassive";
        import type { ResolveInfo } from "@graphitation/supermassive";
        import * as Models from "./models.interface";
        export declare namespace Node {
            export interface Resolvers {
                readonly __resolveType?: __resolveType;
            }
            export type __resolveType = (parent: unknown, context: unknown, info: ResolveInfo) => PromiseOrValue<string | null>;
        }
        export declare namespace User {
            export interface Resolvers {
                readonly id?: id;
                readonly name?: name;
            }
            export type id = (model: Models.User, args: {}, context: unknown, info: ResolveInfo) => PromiseOrValue<string>;
            export type name = (model: Models.User, args: {}, context: unknown, info: ResolveInfo) => PromiseOrValue<string>;
        }
        export declare namespace Query {
            export interface Resolvers {
                readonly users?: users;
            }
            export type users = (model: unknown, args: {}, context: unknown, info: ResolveInfo) => PromiseOrValue<ReadonlyArray<Models.User | null | undefined> | null | undefined>;
        }
        "
      `);
    });

    test("Enum", () => {
      const { resolvers, models, enums, inputs } = runGenerateTest(graphql`
        enum PresenceAvailability {
          Available
          Away
          Offline
        }
        type User {
          id: ID!
          availability: PresenceAvailability!
        }

        extend type Query {
          userById(id: ID!): User
        }
      `);
      expect(enums).toMatchInlineSnapshot(`
        "export enum PresenceAvailability {
            Available = "Available",
            Away = "Away",
            Offline = "Offline"
        }
        "
      `);
      expect(inputs).toMatchInlineSnapshot(`undefined`);
      expect(models).toMatchInlineSnapshot(`
        "import * as Enums from "./enums.interface";
        export * from "./enums.interface";
        // Base type for all models. Enables automatic resolution of abstract GraphQL types (interfaces, unions)
        export interface BaseModel {
            readonly __typename?: string;
        }
        export interface User extends BaseModel {
            readonly __typename?: "User";
            readonly id: string;
            readonly availability: Enums.PresenceAvailability;
        }
        "
      `);
      expect(resolvers).toMatchInlineSnapshot(`
        "import type { PromiseOrValue } from "@graphitation/supermassive";
        import type { ResolveInfo } from "@graphitation/supermassive";
        import * as Models from "./models.interface";
        export declare namespace User {
            export interface Resolvers {
                readonly id?: id;
                readonly availability?: availability;
            }
            export type id = (model: Models.User, args: {}, context: unknown, info: ResolveInfo) => PromiseOrValue<string>;
            export type availability = (model: Models.User, args: {}, context: unknown, info: ResolveInfo) => PromiseOrValue<Models.PresenceAvailability>;
        }
        export declare namespace Query {
            export interface Resolvers {
                readonly userById?: userById;
            }
            export type userById = (model: unknown, args: {
                readonly id: string;
            }, context: unknown, info: ResolveInfo) => PromiseOrValue<Models.User | null | undefined>;
        }
        "
      `);
    });

    test("Union and interface types", () => {
      const { resolvers, models, enums, inputs } = runGenerateTest(graphql`
        type Customer {
          id: ID!
        }

        type Admin {
          id: ID!
        }

        interface Node {
          id: ID!
        }

        union User = Customer | Admin

        extend type Query {
          userById(id: ID!): User
          node(id: ID!): Node
        }
      `);
      expect(enums).toMatchInlineSnapshot(`undefined`);
      expect(inputs).toMatchInlineSnapshot(`undefined`);
      expect(models).toMatchInlineSnapshot(`
        "// Base type for all models. Enables automatic resolution of abstract GraphQL types (interfaces, unions)
        export interface BaseModel {
            readonly __typename?: string;
        }
        export interface Customer extends BaseModel {
            readonly __typename?: "Customer";
            readonly id: string;
        }
        export interface Admin extends BaseModel {
            readonly __typename?: "Admin";
            readonly id: string;
        }
        export interface Node extends BaseModel {
            readonly __typename?: string;
        }
        export type User = Customer | Admin;
        "
      `);
      expect(resolvers).toMatchInlineSnapshot(`
        "import type { PromiseOrValue } from "@graphitation/supermassive";
        import type { ResolveInfo } from "@graphitation/supermassive";
        import * as Models from "./models.interface";
        export declare namespace Customer {
            export interface Resolvers {
                readonly id?: id;
            }
            export type id = (model: Models.Customer, args: {}, context: unknown, info: ResolveInfo) => PromiseOrValue<string>;
        }
        export declare namespace Admin {
            export interface Resolvers {
                readonly id?: id;
            }
            export type id = (model: Models.Admin, args: {}, context: unknown, info: ResolveInfo) => PromiseOrValue<string>;
        }
        export declare namespace Node {
            export interface Resolvers {
                readonly __resolveType?: __resolveType;
            }
            export type __resolveType = (parent: unknown, context: unknown, info: ResolveInfo) => PromiseOrValue<string | null>;
        }
        export declare namespace User {
            export interface Resolvers {
                readonly __resolveType?: __resolveType;
            }
            export type __resolveType = (parent: Models.Customer | Models.Admin, context: unknown, info: ResolveInfo) => PromiseOrValue<"Customer" | "Admin" | null>;
        }
        export declare namespace Query {
            export interface Resolvers {
                readonly userById?: userById;
                readonly node?: node;
            }
            export type userById = (model: unknown, args: {
                readonly id: string;
            }, context: unknown, info: ResolveInfo) => PromiseOrValue<Models.User | null | undefined>;
            export type node = (model: unknown, args: {
                readonly id: string;
            }, context: unknown, info: ResolveInfo) => PromiseOrValue<Models.Node | null | undefined>;
        }
        "
      `);
    });
  });
});

function runGenerateTest(
  doc: string,
  options: {
    outputPath?: string;
    documentPath?: string;
    contextImport?: string;
    contextName?: string;
    legacyCompat?: boolean;
    enumsImport?: string;
    legacyNoModelsForObjects?: boolean;
    legacyEnumsCompatibility?: boolean;
    useStringUnionsInsteadOfEnums?: boolean;
    enumNamesToMigrate?: string[];
    enumNamesToKeep?: string[];
    modelScope?: string;
  } = {},
): {
  enums?: string;
  inputs?: string;
  models: string;
  resolvers: string;
  legacyTypes?: string;
  legacyResolvers?: string;
  legacyNoModelsForObjects?: boolean;
  legacyEnumsCompatibility?: boolean;
  useStringUnionsInsteadOfEnums?: boolean;
  enumNamesToMigrate?: string[];
  enumNamesToKeep?: string[];
  modelScope?: string;
} {
  const fullOptions: {
    outputPath: string;
    documentPath: string;
    contextImport?: string | null;
    contextName?: string;
    legacyCompat?: boolean;
    legacyEnumsCompatibility?: boolean;
    legacyNoModelsForObjects?: boolean;
    useStringUnionsInsteadOfEnums?: boolean;
    enumNamesToMigrate?: string[];
    enumNamesToKeep?: string[];
  } = {
    outputPath: "__generated__",
    documentPath: "./typedef.graphql",
    ...options,
  };
  const document = parse(doc);
  const { files } = generateTS(document, fullOptions);

  function getFileByFileName(fileName: string) {
    return files.find((file) => file.fileName === fileName);
  }

  const { models, resolvers, enums, inputs, legacyTypes, legacyResolvers } = {
    models: getFileByFileName("models.interface.ts") as ts.SourceFile,
    inputs: getFileByFileName("inputs.interface.ts"),
    enums: getFileByFileName("enums.interface.ts"),
    resolvers: getFileByFileName("resolvers.interface.ts") as ts.SourceFile,
    legacyTypes: getFileByFileName("legacy-types.interface.ts"),
    legacyResolvers: getFileByFileName("legacy-resolvers.interface.ts"),
  };

  const printer = ts.createPrinter();

  return {
    enums: enums && printer.printFile(enums),
    inputs: inputs && printer.printFile(inputs),
    models: printer.printFile(models),
    resolvers: printer.printFile(resolvers),
    legacyTypes: legacyTypes && printer.printFile(legacyTypes),
    legacyResolvers: legacyResolvers && printer.printFile(legacyResolvers),
  };
}
