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
          id: ID!
        }

        type User {
          id: ID!
          name: String
          messagesWithAnswersNonRequired: [[Message]]
          messagesWithAnswersRequired: [[Message]]!
          messagesWithAnswersAllRequired: [[Message!]!]!
          messagesNonRequired: [Message]
          messagesWithArrayRequired: [Message]!
          messagesRequired: [Message!]!
          messagesOnlyMessageRequired: [Message!]
          post: Post
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
        export declare namespace Post {
            export interface Resolvers {
                readonly id?: id;
            }
            export type id = (model: Models.Post, args: {}, context: unknown, info: ResolveInfo) => PromiseOrValue<string>;
        }
        export declare namespace Message {
            export interface Resolvers {
                readonly id?: id;
            }
            export type id = (model: Models.Message, args: {}, context: unknown, info: ResolveInfo) => PromiseOrValue<string>;
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
            export type id = (model: Models.User, args: {}, context: unknown, info: ResolveInfo) => PromiseOrValue<string>;
            export type name = (model: Models.User, args: {}, context: unknown, info: ResolveInfo) => PromiseOrValue<string | null | undefined>;
            export type messagesWithAnswersNonRequired = (model: Models.User, args: {}, context: unknown, info: ResolveInfo) => PromiseOrValue<ReadonlyArray<ReadonlyArray<Models.Message | null | undefined> | null | undefined> | null | undefined>;
            export type messagesWithAnswersRequired = (model: Models.User, args: {}, context: unknown, info: ResolveInfo) => PromiseOrValue<ReadonlyArray<ReadonlyArray<Models.Message | null | undefined> | null | undefined>>;
            export type messagesWithAnswersAllRequired = (model: Models.User, args: {}, context: unknown, info: ResolveInfo) => PromiseOrValue<ReadonlyArray<ReadonlyArray<Models.Message>>>;
            export type messagesNonRequired = (model: Models.User, args: {}, context: unknown, info: ResolveInfo) => PromiseOrValue<ReadonlyArray<Models.Message | null | undefined> | null | undefined>;
            export type messagesWithArrayRequired = (model: Models.User, args: {}, context: unknown, info: ResolveInfo) => PromiseOrValue<ReadonlyArray<Models.Message | null | undefined>>;
            export type messagesRequired = (model: Models.User, args: {}, context: unknown, info: ResolveInfo) => PromiseOrValue<ReadonlyArray<Models.Message>>;
            export type messagesOnlyMessageRequired = (model: Models.User, args: {}, context: unknown, info: ResolveInfo) => PromiseOrValue<ReadonlyArray<Models.Message> | null | undefined>;
            export type post = (model: Models.User, args: {}, context: unknown, info: ResolveInfo) => PromiseOrValue<Models.Post | null | undefined>;
            export type postRequired = (model: Models.User, args: {}, context: unknown, info: ResolveInfo) => PromiseOrValue<Models.Post>;
            export type avatar = (model: Models.User, args: {}, context: unknown, info: ResolveInfo) => PromiseOrValue<Avatar | null | undefined>;
            export type avatarRequired = (model: Models.User, args: {}, context: unknown, info: ResolveInfo) => PromiseOrValue<Avatar>;
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
            export type requiredUsers = (model: unknown, args: {}, context: unknown, info: ResolveInfo) => PromiseOrValue<ReadonlyArray<Models.User>>;
            export type optionalUsers = (model: unknown, args: {}, context: unknown, info: ResolveInfo) => PromiseOrValue<ReadonlyArray<Models.User | null | undefined> | null | undefined>;
            export type optionalUser = (model: unknown, args: {}, context: unknown, info: ResolveInfo) => PromiseOrValue<Models.User | null | undefined>;
            export type requiredUser = (model: unknown, args: {}, context: unknown, info: ResolveInfo) => PromiseOrValue<Models.User>;
            export type requiredPost = (model: unknown, args: {}, context: unknown, info: ResolveInfo) => PromiseOrValue<Models.Post>;
            export type optionalPost = (model: unknown, args: {}, context: unknown, info: ResolveInfo) => PromiseOrValue<Models.Post | null | undefined>;
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
        interface Node {
          id: ID!
        }

        interface Persona {
          phone: String!
        }

        interface User implements Node & Persona {
          id: ID!
          name: String!
        }

        type Admin implements Node & Persona {
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
            export type id = (model: Models.Admin, args: {}, context: unknown, info: ResolveInfo) => PromiseOrValue<string>;
            export type rank = (model: Models.Admin, args: {}, context: unknown, info: ResolveInfo) => PromiseOrValue<number>;
        }
        export declare namespace Query {
            export interface Resolvers {
                readonly users?: users;
                readonly admins?: admins;
            }
            export type users = (model: unknown, args: {}, context: unknown, info: ResolveInfo) => PromiseOrValue<ReadonlyArray<Models.User | null | undefined> | null | undefined>;
            export type admins = (model: unknown, args: {}, context: unknown, info: ResolveInfo) => PromiseOrValue<ReadonlyArray<Models.Admin | null | undefined> | null | undefined>;
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
        interface Node {
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

    test("if a type is not used it still need to be imported in resolvers", () => {
      const { resolvers, models, enums, inputs } = runGenerateTest(graphql`
        interface Node {
          id: ID!
        }

        type User implements Node {
          id: ID!
          name: String!
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
        "
      `);
    });

    test("Input", () => {
      const { resolvers, models, enums, inputs } = runGenerateTest(graphql`
        type User {
          id: ID!
        }

        input UserParamsInput {
          name: String
        }

        extend type Query {
          userById(params: UserParamsInput): User
        }
      `);
      expect(enums).toMatchInlineSnapshot(`undefined`);
      expect(inputs).toMatchInlineSnapshot(`
        "export type UserParamsInput = {
            readonly name?: string | null;
        };
        "
      `);
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
        import * as Inputs from "./inputs.interface";
        export * from "./inputs.interface";
        export declare namespace User {
            export interface Resolvers {
                readonly id?: id;
            }
            export type id = (model: Models.User, args: {}, context: unknown, info: ResolveInfo) => PromiseOrValue<string>;
        }
        export declare namespace Query {
            export interface Resolvers {
                readonly userById?: userById;
            }
            export type userById = (model: unknown, args: {
                readonly params?: Inputs.UserParamsInput | null;
            }, context: unknown, info: ResolveInfo) => PromiseOrValue<Models.User | null | undefined>;
        }
        "
      `);
    });

    test("Input containing Enum", () => {
      const { resolvers, models, enums, inputs } = runGenerateTest(graphql`
        type User {
          id: ID!
        }

        enum Rank {
          User
          Admin
        }

        input UserParamsInput {
          name: String
          rank: Rank
        }

        extend type Query {
          userById(params: UserParamsInput): User
        }
      `);
      expect(enums).toMatchInlineSnapshot(`
        "export type Rank = "User" | "Admin";
        "
      `);
      expect(inputs).toMatchInlineSnapshot(`
        "import * as Models from "./models.interface";
        export type UserParamsInput = {
            readonly name?: string | null;
            readonly rank?: Models.Rank | null;
        };
        "
      `);
      expect(models).toMatchInlineSnapshot(`
        "export * from "./enums.interface";
        // Base type for all models. Enables automatic resolution of abstract GraphQL types (interfaces, unions)
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
        import * as Inputs from "./inputs.interface";
        export * from "./inputs.interface";
        export declare namespace User {
            export interface Resolvers {
                readonly id?: id;
            }
            export type id = (model: Models.User, args: {}, context: unknown, info: ResolveInfo) => PromiseOrValue<string>;
        }
        export declare namespace Query {
            export interface Resolvers {
                readonly userById?: userById;
            }
            export type userById = (model: unknown, args: {
                readonly params?: Inputs.UserParamsInput | null;
            }, context: unknown, info: ResolveInfo) => PromiseOrValue<Models.User | null | undefined>;
        }
        "
      `);
    });

    test("Two nested Inputs", () => {
      const { resolvers, models, enums, inputs } = runGenerateTest(graphql`
        type User {
          id: ID!
        }

        input PresenceInput {
          type: String!
        }

        input UserParamsInput {
          name: String!
          presence: PresenceInput
        }

        extend type Query {
          userById(params: UserParamsInput): User
        }
      `);
      expect(enums).toMatchInlineSnapshot(`undefined`);
      expect(inputs).toMatchInlineSnapshot(`
        "export type PresenceInput = {
            readonly type: string;
        };
        export type UserParamsInput = {
            readonly name: string;
            readonly presence?: PresenceInput | null;
        };
        "
      `);
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
        import * as Inputs from "./inputs.interface";
        export * from "./inputs.interface";
        export declare namespace User {
            export interface Resolvers {
                readonly id?: id;
            }
            export type id = (model: Models.User, args: {}, context: unknown, info: ResolveInfo) => PromiseOrValue<string>;
        }
        export declare namespace Query {
            export interface Resolvers {
                readonly userById?: userById;
            }
            export type userById = (model: unknown, args: {
                readonly params?: Inputs.UserParamsInput | null;
            }, context: unknown, info: ResolveInfo) => PromiseOrValue<Models.User | null | undefined>;
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
        "export type PresenceAvailability = "Available" | "Away" | "Offline";
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

    test("Legacy enums compatibility mode", () => {
      const { resolvers, models, enums, inputs } = runGenerateTest(
        graphql`
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
        `,
        { legacyEnumsCompatibility: true },
      );
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
            readonly availability: Enums.PresenceAvailability | \`\${Enums.PresenceAvailability}\`;
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
  describe("Models", () => {
    it('should import the model and use it in User type"', () => {
      const { resolvers, models, enums, inputs } = runGenerateTest(graphql`
        type User @model(from: "./user-model.interface", tsType: "UserModel") {
          id: ID!
        }

        extend type Query {
          userById(id: ID!): User
        }
      `);
      expect(enums).toMatchInlineSnapshot(`undefined`);
      expect(inputs).toMatchInlineSnapshot(`undefined`);
      expect(models).toMatchInlineSnapshot(`
        "import type { UserModel as _User } from "../user-model.interface";
        // Base type for all models. Enables automatic resolution of abstract GraphQL types (interfaces, unions)
        export interface BaseModel {
            readonly __typename?: string;
        }
        export interface User extends BaseModel, _User {
            readonly __typename?: "User";
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
                readonly userById?: userById;
            }
            export type userById = (model: unknown, args: {
                readonly id: string;
            }, context: unknown, info: ResolveInfo) => PromiseOrValue<Models.User | null | undefined>;
        }
        "
      `);
    });
  });

  describe("Import", () => {
    it("shouldn't include Query, Mutation and Subscription in the models", () => {
      const { resolvers, models, enums, inputs } = runGenerateTest(graphql`
        type Query {
          allTodos: [Todo!]!
        }

        type Mutation {
          createTodo: Todo!
        }

        type Subscription {
          emitTodos: Todo
        }

        type Todo {
          id: ID!
          name: String!
        }
      `);
      expect(enums).toMatchInlineSnapshot(`undefined`);
      expect(inputs).toMatchInlineSnapshot(`undefined`);
      expect(models).toMatchInlineSnapshot(`
        "// Base type for all models. Enables automatic resolution of abstract GraphQL types (interfaces, unions)
        export interface BaseModel {
            readonly __typename?: string;
        }
        export interface Todo extends BaseModel {
            readonly __typename?: "Todo";
            readonly id: string;
            readonly name: string;
        }
        "
      `);
      expect(resolvers).toMatchInlineSnapshot(`
        "import type { PromiseOrValue } from "@graphitation/supermassive";
        import type { ResolveInfo } from "@graphitation/supermassive";
        import * as Models from "./models.interface";
        export declare namespace Query {
            export interface Resolvers {
                readonly allTodos?: allTodos;
            }
            export type allTodos = (model: unknown, args: {}, context: unknown, info: ResolveInfo) => PromiseOrValue<ReadonlyArray<Models.Todo>>;
        }
        export declare namespace Mutation {
            export interface Resolvers {
                readonly createTodo?: createTodo;
            }
            export type createTodo = (model: unknown, args: {}, context: unknown, info: ResolveInfo) => PromiseOrValue<Models.Todo>;
        }
        export declare namespace Subscription {
            export interface Resolvers {
                readonly emitTodos?: emitTodos<any>;
            }
            export type emitTodos<SubscribeResult = never> = {
                subscribe: (model: unknown, args: {}, context: unknown, info: ResolveInfo) => PromiseOrValue<AsyncIterator<{
                    emitTodos: Models.Todo | null | undefined;
                }>>;
            } | {
                subscribe: (model: unknown, args: {}, context: unknown, info: ResolveInfo) => PromiseOrValue<AsyncIterator<SubscribeResult>>;
                resolve: (subcribeResult: SubscribeResult, args: {}, context: unknown, info: ResolveInfo) => PromiseOrValue<Models.Todo | null | undefined>;
            };
        }
        export declare namespace Todo {
            export interface Resolvers {
                readonly id?: id;
                readonly name?: name;
            }
            export type id = (model: Models.Todo, args: {}, context: unknown, info: ResolveInfo) => PromiseOrValue<string>;
            export type name = (model: Models.Todo, args: {}, context: unknown, info: ResolveInfo) => PromiseOrValue<string>;
        }
        "
      `);
    });

    it("should import Avatar type and use it in User type", () => {
      const { resolvers, models, enums, inputs } = runGenerateTest(graphql`
        extend schema @import(from: "@msteams/packages-test", defs: ["Avatar"])
        type User {
          id: ID!
          avatar: Avatar!
        }

        extend type Query {
          userById(id: ID!): User
        }
      `);
      expect(enums).toMatchInlineSnapshot(`undefined`);
      expect(inputs).toMatchInlineSnapshot(`undefined`);
      expect(models).toMatchInlineSnapshot(`
        "import type { Avatar } from "@msteams/packages-test";
        // Base type for all models. Enables automatic resolution of abstract GraphQL types (interfaces, unions)
        export interface BaseModel {
            readonly __typename?: string;
        }
        export interface User extends BaseModel {
            readonly __typename?: "User";
            readonly id: string;
            readonly avatar: Avatar;
        }
        "
      `);
      expect(resolvers).toMatchInlineSnapshot(`
        "import type { Avatar } from "@msteams/packages-test";
        import type { PromiseOrValue } from "@graphitation/supermassive";
        import type { ResolveInfo } from "@graphitation/supermassive";
        import * as Models from "./models.interface";
        export declare namespace User {
            export interface Resolvers {
                readonly id?: id;
                readonly avatar?: avatar;
            }
            export type id = (model: Models.User, args: {}, context: unknown, info: ResolveInfo) => PromiseOrValue<string>;
            export type avatar = (model: Models.User, args: {}, context: unknown, info: ResolveInfo) => PromiseOrValue<Avatar>;
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
  });

  it("imports an entity, which is used to implement interface and returned by resolver", () => {
    const { resolvers, models, enums, inputs } = runGenerateTest(graphql`
      extend schema @import(from: "@msteams/packages-test", defs: ["Entity"])

      interface Person implements Entity {
        id: ID!
      }

      type User implements Person {
        id: ID!
      }

      extend type Query {
        userById(id: ID!): Person
      }
    `);
    expect(enums).toMatchInlineSnapshot(`undefined`);
    expect(inputs).toMatchInlineSnapshot(`undefined`);
    expect(models).toMatchInlineSnapshot(`
      "import type { Entity } from "@msteams/packages-test";
      // Base type for all models. Enables automatic resolution of abstract GraphQL types (interfaces, unions)
      export interface BaseModel {
          readonly __typename?: string;
      }
      export interface Person extends BaseModel, Entity {
          readonly __typename?: string;
      }
      export interface User extends BaseModel, Person {
          readonly __typename?: "User";
          readonly id: string;
      }
      "
    `);
    expect(resolvers).toMatchInlineSnapshot(`
      "import type { PromiseOrValue } from "@graphitation/supermassive";
      import type { ResolveInfo } from "@graphitation/supermassive";
      import * as Models from "./models.interface";
      export declare namespace Person {
          export interface Resolvers {
              readonly __resolveType?: __resolveType;
          }
          export type __resolveType = (parent: unknown, context: unknown, info: ResolveInfo) => PromiseOrValue<string | null>;
      }
      export declare namespace User {
          export interface Resolvers {
              readonly id?: id;
          }
          export type id = (model: Models.User, args: {}, context: unknown, info: ResolveInfo) => PromiseOrValue<string>;
      }
      export declare namespace Query {
          export interface Resolvers {
              readonly userById?: userById;
          }
          export type userById = (model: unknown, args: {
              readonly id: string;
          }, context: unknown, info: ResolveInfo) => PromiseOrValue<Models.Person | null | undefined>;
      }
      "
    `);
  });

  it("imports an entity, which is used in a type", () => {
    const { resolvers, models, enums, inputs } = runGenerateTest(graphql`
      extend schema
        @import(from: "@msteams/packages-node", defs: ["Node"])
        @import(from: "@msteams/packages-rank", defs: ["Rank"])

      type User {
        id: ID!
        rank: Rank!
      }

      extend type Query {
        userById(id: ID!): User
      }
    `);
    expect(enums).toMatchInlineSnapshot(`undefined`);
    expect(inputs).toMatchInlineSnapshot(`undefined`);
    expect(models).toMatchInlineSnapshot(`
      "import type { Rank } from "@msteams/packages-rank";
      // Base type for all models. Enables automatic resolution of abstract GraphQL types (interfaces, unions)
      export interface BaseModel {
          readonly __typename?: string;
      }
      export interface User extends BaseModel {
          readonly __typename?: "User";
          readonly id: string;
          readonly rank: Rank;
      }
      "
    `);
    expect(resolvers).toMatchInlineSnapshot(`
      "import type { Rank } from "@msteams/packages-rank";
      import type { PromiseOrValue } from "@graphitation/supermassive";
      import type { ResolveInfo } from "@graphitation/supermassive";
      import * as Models from "./models.interface";
      export declare namespace User {
          export interface Resolvers {
              readonly id?: id;
              readonly rank?: rank;
          }
          export type id = (model: Models.User, args: {}, context: unknown, info: ResolveInfo) => PromiseOrValue<string>;
          export type rank = (model: Models.User, args: {}, context: unknown, info: ResolveInfo) => PromiseOrValue<Rank>;
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

  it("works when an operation has scalar, input and Enum as parameters", () => {
    const { resolvers, models, enums, inputs } = runGenerateTest(graphql`
      extend schema
        @import(from: "@msteams/packages-node", defs: ["Node"])
        @import(from: "@msteams/packages-rank", defs: ["Rank"])

      scalar DateTime

      input UserParam {
        id: ID!
        rank: Rank!
      }

      enum UserType {
        Admin
        User
      }

      extend type Query {
        isUser(
          userParam: UserParam!
          userType: UserType!
          dateTime: DateTime!
        ): Boolean
      }
    `);
    expect(enums).toMatchInlineSnapshot(`
      "export type UserType = "Admin" | "User";
      "
    `);
    expect(inputs).toMatchInlineSnapshot(`
      "import type { Rank } from "@msteams/packages-rank";
      export type UserParam = {
          readonly id: string;
          readonly rank: Rank;
      };
      "
    `);
    expect(models).toMatchInlineSnapshot(`
      "export * from "./enums.interface";
      // Base type for all models. Enables automatic resolution of abstract GraphQL types (interfaces, unions)
      export interface BaseModel {
          readonly __typename?: string;
      }
      export type DateTime = unknown;
      "
    `);
    expect(resolvers).toMatchInlineSnapshot(`
      "import type { PromiseOrValue } from "@graphitation/supermassive";
      import type { ResolveInfo } from "@graphitation/supermassive";
      import * as Models from "./models.interface";
      import * as Inputs from "./inputs.interface";
      export * from "./inputs.interface";
      export declare namespace Query {
          export interface Resolvers {
              readonly isUser?: isUser;
          }
          export type isUser = (model: unknown, args: {
              readonly userParam: Inputs.UserParam;
              readonly userType: Models.UserType;
              readonly dateTime: Models.DateTime;
          }, context: unknown, info: ResolveInfo) => PromiseOrValue<boolean | null | undefined>;
      }
      "
    `);
  });

  it("imports an entity, which is used in an input", () => {
    const { resolvers, models, enums, inputs } = runGenerateTest(graphql`
      extend schema
        @import(from: "@msteams/packages-node", defs: ["Node"])
        @import(from: "@msteams/packages-rank", defs: ["Rank"])

      type User {
        id: ID!
        rank: Rank!
      }

      input UserInput {
        id: ID!
        rank: Rank!
      }

      extend type Query {
        userById(params: UserInput): User
      }
    `);
    expect(enums).toMatchInlineSnapshot(`undefined`);
    expect(inputs).toMatchInlineSnapshot(`
      "import type { Rank } from "@msteams/packages-rank";
      export type UserInput = {
          readonly id: string;
          readonly rank: Rank;
      };
      "
    `);
    expect(models).toMatchInlineSnapshot(`
      "import type { Rank } from "@msteams/packages-rank";
      // Base type for all models. Enables automatic resolution of abstract GraphQL types (interfaces, unions)
      export interface BaseModel {
          readonly __typename?: string;
      }
      export interface User extends BaseModel {
          readonly __typename?: "User";
          readonly id: string;
          readonly rank: Rank;
      }
      "
    `);
    expect(resolvers).toMatchInlineSnapshot(`
      "import type { Rank } from "@msteams/packages-rank";
      import type { PromiseOrValue } from "@graphitation/supermassive";
      import type { ResolveInfo } from "@graphitation/supermassive";
      import * as Models from "./models.interface";
      import * as Inputs from "./inputs.interface";
      export * from "./inputs.interface";
      export declare namespace User {
          export interface Resolvers {
              readonly id?: id;
              readonly rank?: rank;
          }
          export type id = (model: Models.User, args: {}, context: unknown, info: ResolveInfo) => PromiseOrValue<string>;
          export type rank = (model: Models.User, args: {}, context: unknown, info: ResolveInfo) => PromiseOrValue<Rank>;
      }
      export declare namespace Query {
          export interface Resolvers {
              readonly userById?: userById;
          }
          export type userById = (model: unknown, args: {
              readonly params?: Inputs.UserInput | null;
          }, context: unknown, info: ResolveInfo) => PromiseOrValue<Models.User | null | undefined>;
      }
      "
    `);
  });

  it("imported Rank shouldn't be imported in the model, because it's used in a type, which has the model directive", () => {
    const { resolvers, models, enums, inputs } = runGenerateTest(graphql`
      extend schema
        @import(from: "@msteams/packages-node", defs: ["Node"])
        @import(from: "@msteams/packages-rank", defs: ["Rank"])

      type User @model(tsType: "User", from: "@msteams/custom-user") {
        id: ID!
        rank: Rank!
      }

      extend type Query {
        userById(id: ID!): User
      }
    `);
    expect(enums).toMatchInlineSnapshot(`undefined`);
    expect(inputs).toMatchInlineSnapshot(`undefined`);
    expect(models).toMatchInlineSnapshot(`
      "import type { User as _User } from "@msteams/custom-user";
      // Base type for all models. Enables automatic resolution of abstract GraphQL types (interfaces, unions)
      export interface BaseModel {
          readonly __typename?: string;
      }
      export interface User extends BaseModel, _User {
          readonly __typename?: "User";
      }
      "
    `);
    expect(resolvers).toMatchInlineSnapshot(`
      "import type { Rank } from "@msteams/packages-rank";
      import type { PromiseOrValue } from "@graphitation/supermassive";
      import type { ResolveInfo } from "@graphitation/supermassive";
      import * as Models from "./models.interface";
      export declare namespace User {
          export interface Resolvers {
              readonly id?: id;
              readonly rank?: rank;
          }
          export type id = (model: Models.User, args: {}, context: unknown, info: ResolveInfo) => PromiseOrValue<string>;
          export type rank = (model: Models.User, args: {}, context: unknown, info: ResolveInfo) => PromiseOrValue<Rank>;
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

  it("imports an entity, which is used in a nested input", () => {
    const { resolvers, models, enums, inputs } = runGenerateTest(graphql`
      extend schema
        @import(from: "@msteams/packages-node", defs: ["Node"])
        @import(from: "@msteams/packages-rank", defs: ["Rank"])

      type User {
        id: ID!
        rank: Rank!
      }

      input RankParams {
        rank: Rank!
      }

      input UserParams {
        id: ID!
        rank: RankParams!
      }

      extend type Query {
        userById(params: UserParams): User
      }
    `);
    expect(enums).toMatchInlineSnapshot(`undefined`);
    expect(inputs).toMatchInlineSnapshot(`
      "import type { Rank } from "@msteams/packages-rank";
      export type RankParams = {
          readonly rank: Rank;
      };
      export type UserParams = {
          readonly id: string;
          readonly rank: RankParams;
      };
      "
    `);
    expect(models).toMatchInlineSnapshot(`
      "import type { Rank } from "@msteams/packages-rank";
      // Base type for all models. Enables automatic resolution of abstract GraphQL types (interfaces, unions)
      export interface BaseModel {
          readonly __typename?: string;
      }
      export interface User extends BaseModel {
          readonly __typename?: "User";
          readonly id: string;
          readonly rank: Rank;
      }
      "
    `);
    expect(resolvers).toMatchInlineSnapshot(`
      "import type { Rank } from "@msteams/packages-rank";
      import type { PromiseOrValue } from "@graphitation/supermassive";
      import type { ResolveInfo } from "@graphitation/supermassive";
      import * as Models from "./models.interface";
      import * as Inputs from "./inputs.interface";
      export * from "./inputs.interface";
      export declare namespace User {
          export interface Resolvers {
              readonly id?: id;
              readonly rank?: rank;
          }
          export type id = (model: Models.User, args: {}, context: unknown, info: ResolveInfo) => PromiseOrValue<string>;
          export type rank = (model: Models.User, args: {}, context: unknown, info: ResolveInfo) => PromiseOrValue<Rank>;
      }
      export declare namespace Query {
          export interface Resolvers {
              readonly userById?: userById;
          }
          export type userById = (model: unknown, args: {
              readonly params?: Inputs.UserParams | null;
          }, context: unknown, info: ResolveInfo) => PromiseOrValue<Models.User | null | undefined>;
      }
      "
    `);
  });

  describe("Scalars", () => {
    it('expects custom scalars "DateTime" to be "string"', () => {
      const { resolvers, models, enums, inputs } = runGenerateTest(graphql`
        scalar DateTime @model(tsType: "string")

        type User {
          id: ID!
          dateTime: DateTime!
        }

        extend type Query {
          userById(id: ID!): User
        }
      `);
      expect(enums).toMatchInlineSnapshot(`undefined`);
      expect(inputs).toMatchInlineSnapshot(`undefined`);
      expect(models).toMatchInlineSnapshot(`
        "// Base type for all models. Enables automatic resolution of abstract GraphQL types (interfaces, unions)
        export interface BaseModel {
            readonly __typename?: string;
        }
        export type DateTime = string;
        export interface User extends BaseModel {
            readonly __typename?: "User";
            readonly id: string;
            readonly dateTime: DateTime;
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
                readonly dateTime?: dateTime;
            }
            export type id = (model: Models.User, args: {}, context: unknown, info: ResolveInfo) => PromiseOrValue<string>;
            export type dateTime = (model: Models.User, args: {}, context: unknown, info: ResolveInfo) => PromiseOrValue<Models.DateTime>;
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
    it('expects custom scalars "DateTime" to be model', () => {
      const { resolvers, models, enums, inputs } = runGenerateTest(graphql`
        scalar DateTime
          @model(tsType: "DateTimeModel", from: "@msteams/custom-scalars")

        type User {
          id: ID!
          dateTime: DateTime!
        }

        extend type Query {
          userById(id: ID!): User
        }
      `);
      expect(enums).toMatchInlineSnapshot(`undefined`);
      expect(inputs).toMatchInlineSnapshot(`undefined`);
      expect(models).toMatchInlineSnapshot(`
        "import type { DateTimeModel as _DateTime } from "@msteams/custom-scalars";
        // Base type for all models. Enables automatic resolution of abstract GraphQL types (interfaces, unions)
        export interface BaseModel {
            readonly __typename?: string;
        }
        export type DateTime = _DateTime;
        export interface User extends BaseModel {
            readonly __typename?: "User";
            readonly id: string;
            readonly dateTime: DateTime;
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
                readonly dateTime?: dateTime;
            }
            export type id = (model: Models.User, args: {}, context: unknown, info: ResolveInfo) => PromiseOrValue<string>;
            export type dateTime = (model: Models.User, args: {}, context: unknown, info: ResolveInfo) => PromiseOrValue<Models.DateTime>;
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
    it("expects built-in scalars to not be generated in models and typescript types used directly in resolvers", () => {
      const { resolvers, models, enums, inputs } = runGenerateTest(graphql`
        type User {
          id: ID!
          name: String!
          age: Int
          rating: Float
          isAdmin: Boolean!
        }

        extend type Query {
          node(
            id: ID!
            name: String!
            age: Int
            rating: Float
            isAdmin: Boolean
          ): User!
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
            readonly name: string;
            readonly age?: number | null;
            readonly rating?: number | null;
            readonly isAdmin: boolean;
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
                readonly name?: name;
                readonly age?: age;
                readonly rating?: rating;
                readonly isAdmin?: isAdmin;
            }
            export type id = (model: Models.User, args: {}, context: unknown, info: ResolveInfo) => PromiseOrValue<string>;
            export type name = (model: Models.User, args: {}, context: unknown, info: ResolveInfo) => PromiseOrValue<string>;
            export type age = (model: Models.User, args: {}, context: unknown, info: ResolveInfo) => PromiseOrValue<number | null | undefined>;
            export type rating = (model: Models.User, args: {}, context: unknown, info: ResolveInfo) => PromiseOrValue<number | null | undefined>;
            export type isAdmin = (model: Models.User, args: {}, context: unknown, info: ResolveInfo) => PromiseOrValue<boolean>;
        }
        export declare namespace Query {
            export interface Resolvers {
                readonly node?: node;
            }
            export type node = (model: unknown, args: {
                readonly id: string;
                readonly name: string;
                readonly age?: number | null;
                readonly rating?: number | null;
                readonly isAdmin?: boolean | null;
            }, context: unknown, info: ResolveInfo) => PromiseOrValue<Models.User>;
        }
        "
      `);
    });
  });

  it("generateTS without ContextName and ContextImport", () => {
    const { models, resolvers, enums, inputs } = runGenerateTest(graphql`
      interface Node {
        id: ID!
      }

      extend type Query {
        node(id: ID!): Node!
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
      export declare namespace Query {
          export interface Resolvers {
              readonly node?: node;
          }
          export type node = (model: unknown, args: {
              readonly id: string;
          }, context: unknown, info: ResolveInfo) => PromiseOrValue<Models.Node>;
      }
      "
    `);
  });

  it("generateTS with legacy compat mode", () => {
    const { models, resolvers, legacyTypes, enums, inputs } = runGenerateTest(
      graphql`
        interface Node {
          id: ID!
        }

        enum Type {
          type1
          type2
        }

        type User implements Node {
          id: ID!
        }

        type Admin implements Node {
          id: ID!
        }

        union Users = Admin | User

        extend type Query {
          node(id: ID!): Node!
        }
      `,
      { legacyCompat: true },
    );
    expect(enums).toMatchInlineSnapshot(`
      "export type Type = "type1" | "type2";
      "
    `);
    expect(inputs).toMatchInlineSnapshot(`undefined`);
    expect(models).toMatchInlineSnapshot(`
      "export * from "./enums.interface";
      // Base type for all models. Enables automatic resolution of abstract GraphQL types (interfaces, unions)
      export interface BaseModel {
          readonly __typename?: string;
      }
      export interface Node extends BaseModel {
          readonly __typename?: string;
      }
      export interface User extends BaseModel, Node {
          readonly __typename?: "User";
          readonly id: string;
      }
      export interface Admin extends BaseModel, Node {
          readonly __typename?: "Admin";
          readonly id: string;
      }
      export type Users = Admin | User;
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
          }
          export type id = (model: Models.User, args: {}, context: unknown, info: ResolveInfo) => PromiseOrValue<string>;
      }
      export declare namespace Admin {
          export interface Resolvers {
              readonly id?: id;
          }
          export type id = (model: Models.Admin, args: {}, context: unknown, info: ResolveInfo) => PromiseOrValue<string>;
      }
      export declare namespace Users {
          export interface Resolvers {
              readonly __resolveType?: __resolveType;
          }
          export type __resolveType = (parent: Models.Admin | Models.User, context: unknown, info: ResolveInfo) => PromiseOrValue<"Admin" | "User" | null>;
      }
      export declare namespace Query {
          export interface Resolvers {
              readonly node?: node;
          }
          export type node = (model: unknown, args: {
              readonly id: string;
          }, context: unknown, info: ResolveInfo) => PromiseOrValue<Models.Node>;
      }
      "
    `);
    expect(legacyTypes).toMatchInlineSnapshot(`
      "import * as Models from "./models.interface";
      import * as Resolvers from "./resolvers.interface";
      export * from "./models.interface";
      export * from "./enums.interface";
      export interface Scalars {
          readonly ID: string;
          readonly Int: number;
          readonly Float: number;
          readonly String: string;
          readonly Boolean: boolean;
      }
      export interface Types {
          readonly Node: Models.Node;
          readonly Type: Models.Type;
          readonly User: Models.User;
          readonly Admin: Models.Admin;
          readonly Users: Models.Users;
      }
      "
    `);
  });

  it("legacy interfaces", () => {
    const { models, resolvers, enums, inputs } = runGenerateTest(
      graphql`
        interface MyInterface @legacyInterface_DO_NOT_USE {
          id: ID!
          field: String
        }
      `,
      { legacyCompat: true },
    );
    expect(enums).toMatchInlineSnapshot(`undefined`);
    expect(inputs).toMatchInlineSnapshot(`undefined`);
    expect(models).toMatchInlineSnapshot(`
      "// Base type for all models. Enables automatic resolution of abstract GraphQL types (interfaces, unions)
      export interface BaseModel {
          readonly __typename?: string;
      }
      export interface MyInterface extends BaseModel {
          readonly __typename?: string;
          readonly id: string;
          readonly field?: string | null;
      }
      "
    `);
    expect(resolvers).toMatchInlineSnapshot(`
      "import type { PromiseOrValue } from "@graphitation/supermassive";
      import type { ResolveInfo } from "@graphitation/supermassive";
      import * as Models from "./models.interface";
      export declare namespace MyInterface {
          export interface Resolvers {
              readonly __resolveType?: __resolveType;
          }
          export type __resolveType = (parent: unknown, context: unknown, info: ResolveInfo) => PromiseOrValue<string | null>;
      }
      "
    `);
  });

  it("handles reserved keywords", () => {
    const { models, resolvers, enums, inputs } = runGenerateTest(
      graphql`
        input FooInput {
          default: String!
          number: Bar!
        }

        type Foo {
          default: String!
          number: Bar!
        }
      `,
    );

    expect(enums).toMatchInlineSnapshot(`undefined`);
    expect(inputs).toMatchInlineSnapshot(`
      "export type FooInput = {
          readonly default: string;
          readonly number: Bar;
      };
      "
    `);
    expect(models).toMatchInlineSnapshot(`
      "// Base type for all models. Enables automatic resolution of abstract GraphQL types (interfaces, unions)
      export interface BaseModel {
          readonly __typename?: string;
      }
      export interface Foo extends BaseModel {
          readonly __typename?: "Foo";
          readonly default: string;
          readonly number: Bar;
      }
      "
    `);
    expect(resolvers).toMatchInlineSnapshot(`
      "import type { PromiseOrValue } from "@graphitation/supermassive";
      import type { ResolveInfo } from "@graphitation/supermassive";
      import * as Models from "./models.interface";
      import * as Inputs from "./inputs.interface";
      export * from "./inputs.interface";
      export declare namespace Foo {
          export interface Resolvers {
              readonly default?: _default;
              readonly number?: _number;
          }
          export type _default = (model: Models.Foo, args: {}, context: unknown, info: ResolveInfo) => PromiseOrValue<string>;
          export type _number = (model: Models.Foo, args: {}, context: unknown, info: ResolveInfo) => PromiseOrValue<Models.Bar>;
      }
      "
    `);
  });

  it("legacy import enums", () => {
    const { models, resolvers, enums, inputs } = runGenerateTest(
      graphql`
        enum Foo {
          Bar
          Braz
        }
      `,
      {
        enumsImport: "common-enums",
      },
    );

    expect(enums).toMatchInlineSnapshot(`
      "export { Foo } from "common-enums";
      "
    `);
    expect(inputs).toMatchInlineSnapshot(`undefined`);
    expect(models).toMatchInlineSnapshot(`
      "export * from "./enums.interface";
      // Base type for all models. Enables automatic resolution of abstract GraphQL types (interfaces, unions)
      export interface BaseModel {
          readonly __typename?: string;
      }
      "
    `);
    expect(resolvers).toMatchInlineSnapshot(`
      "import type { PromiseOrValue } from "@graphitation/supermassive";
      import type { ResolveInfo } from "@graphitation/supermassive";
      import * as Models from "./models.interface";
      "
    `);
  });

  it("does not generate models in legacy mode", () => {
    const { models } = runGenerateTest(
      graphql`
        scalar Foo @model(tsType: "string")

        enum Baz {
          ONE
          TWO
        }

        type Bar @model(tsType: "BarModel", from: "./bar_model.interface") {
          id: ID!
          foo: Foo
          baz: Baz
        }
      `,
      {
        legacyNoModelsForObjects: true,
      },
    );

    expect(models).toMatch("type Foo = string");
    expect(models).toMatch("Enums.Baz");
    expect(models).not.toMatch("extends BaseModel, _Bar");
    expect(models).not.toMatch("import type { BarModel as _Bar");
  });

  it("uses only models that match the scope", () => {
    const { models } = runGenerateTest(
      graphql`
        enum ModelScope {
          our
          other
        }

        type BlankScope
          @model(tsType: "BlankScopeModel", from: "./blankmodels.interface") {
          id: ID!
        }

        type WrongScope
          @model(
            tsType: "WrongScopeModel"
            from: "./wrongmodels.interface"
            scope: "other"
          ) {
          id: ID!
        }

        type EnumScope
          @model(
            tsType: "EnumScopeModel"
            from: "./enummodels.interface"
            scope: our
          ) {
          id: ID!
        }

        type StringScope
          @model(
            tsType: "StringScopeModel"
            from: "./stringmodels.interface"
            scope: "our"
          ) {
          id: ID!
        }
      `,
      {
        modelScope: "our",
      },
    );

    expect(models).not.toMatch("extends BaseModel, _BlankScope");
    expect(models).not.toMatch("import type { BlankScopeModel as _BlankScope");
    expect(models).not.toMatch("extends BaseModel, _WrongScope");
    expect(models).not.toMatch("import type { WrongScopeModel as _WrongScope");
    expect(models).toMatch("extends BaseModel, _EnumScope");
    expect(models).toMatch("import type { EnumScopeModel as _EnumScope");
    expect(models).toMatch("extends BaseModel, _StringScope");
    expect(models).toMatch("import type { StringScopeModel as _StringScope");
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
