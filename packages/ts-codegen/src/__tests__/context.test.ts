import ts from "typescript";
import { parse } from "graphql";
import { blankGraphQLTag as graphql } from "../utilities";
import { generateTS } from "..";
import { ContextMap } from "../context";
import { SubTypeNamespace } from "../codegen";

describe(generateTS, () => {
  describe("Tests basic syntax GraphQL syntax", () => {
    const contextSubTypeMetadata = {
      managers: {
        user: {
          name: "user",
          importTypeName: 'UserStateMachineType["user"]',
          importPath: "@package/user-state-machine",
        },
        whatever: {
          name: "whatever",
          importTypeName: 'WhateverStateMachineType["whatever"]',
          importPath: "@package/whatever-state-machine",
        },
        "different-whatever": {
          name: "different-whatever",
          importTypeName:
            'DifferentWhateverStateMachineType["different-whatever"]',
          importPath: "@package/different-whatever-state-machine",
        },
        post: {
          name: "post",
          importTypeName: 'PostStateMachineType["post"]',
          importPath: "@package/post-state-machine",
        },
        node: {
          name: "node",
          importTypeName: 'NodeStateMachineType["node"]',
          importPath: "@package/node-state-machine",
        },
        persona: {
          name: "persona",
          importTypeName: 'PersonaStateMachineType["persona"]',
          importPath: "@package/persona-state-machine",
        },
        admin: {
          name: "admin",
          importTypeName: 'AdminStateMachineType["admin"]',
          importPath: "@package/admin-state-machine",
        },
        message: {
          name: "message",
          importTypeName: 'MessageStateMachineType["message"]',
          importPath: "@package/message-state-machine",
        },
        customer: {
          name: "customer",
          importTypeName: 'CustomerStateMachineType["customer"]',
          importPath: "@package/customer-state-machine",
        },
        "shouldnt-apply": {
          name: "shouldnt-apply",
          importTypeName: 'UserStateMachineType["shouldnt-apply"]',
          importPath: "@package/shouldnt-apply-state-machine",
        },
        "user-or-customer": {
          name: "user-or-customer",
          importTypeName: 'UserStateMachineType["user-or-customer"]',
          importPath: "@package/user-or-customer-state-machine",
        },
        "company-or-customer": {
          name: "company-or-customer",
          importTypeName: 'UserStateMachineType["company-or-customer"]',
          importPath: "@package/company-or-customer-state-machine",
        },
        "id-user": {
          name: "id-user",
          importTypeName: 'UserStateMachineType["id-user"]',
          importPath: "@package/id-user-state-machine",
        },
      },
    };
    test("all possible nullable and non-nullable combinations", () => {
      const { resolvers, models, enums, inputs, contextMappingOutput } =
        runGenerateTest(
          graphql`
            extend schema
              @import(from: "@msteams/packages-test", defs: ["Avatar"])
            type Post
              @model(from: "./post-model.interface", tsType: "PostModel") {
              id: ID!
            }

            type Message {
              id: ID! @context(uses: { managers: ["message"] })
            }

            type User @context(uses: { managers: ["user"] }) {
              id: ID! @context(uses: { managers: ["id-user"] })
              name: String
              messagesWithAnswersNonRequired: [[Message]]
              messagesWithAnswersRequired: [[Message]]!
              messagesWithAnswersAllRequired: [[Message!]!]!
              messagesNonRequired: [Message]
              messagesWithArrayRequired: [Message]!
              messagesRequired: [Message!]!
              messagesOnlyMessageRequired: [Message!]
              post: Post @context(uses: { managers: ["post"] })
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
          `,
          {
            contextSubTypeMetadata: contextSubTypeMetadata,
          },
        );
      expect(enums).toMatchInlineSnapshot(`undefined`);
      expect(contextMappingOutput).toMatchInlineSnapshot(`
        {
          "Message": {
            "id": [
              "message",
            ],
          },
          "User": {
            "__context": [
              "user",
            ],
            "id": [
              "id-user",
            ],
            "post": [
              "post",
            ],
          },
        }
      `);
      expect(inputs).toMatchInlineSnapshot(`undefined`);
      expect(models).toMatchInlineSnapshot(`
        "import type { models as NSMsteamsPackagesTestModels } from "@msteams/packages-test";
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
            readonly avatar?: NSMsteamsPackagesTestModels.Avatar | null;
            readonly avatarRequired: NSMsteamsPackagesTestModels.Avatar;
        }
        "
      `);
      expect(resolvers).toMatchInlineSnapshot(`
        "import type { models as NSMsteamsPackagesTestModels } from "@msteams/packages-test";
        import type { PromiseOrValue } from "@graphitation/supermassive";
        import type { ResolveInfo } from "@graphitation/supermassive";
        import * as Models from "./models.interface";
        import type { IMessageStateMachineContext } from "@msteams/core-cdl-sync-message";
        import type { IUserStateMachineContext } from "@msteams/core-cdl-sync-user";
        import type { IIdUserStateMachineContext } from "@msteams/core-cdl-sync-id-user";
        import type { IPostStateMachineContext } from "@msteams/core-cdl-sync-post";
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
            export type id = (model: Models.Message, args: {}, context: IMessageStateMachineContext, info: ResolveInfo) => PromiseOrValue<string>;
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
            export type id = (model: Models.User, args: {}, context: IIdUserStateMachineContext, info: ResolveInfo) => PromiseOrValue<string>;
            export type name = (model: Models.User, args: {}, context: IUserStateMachineContext, info: ResolveInfo) => PromiseOrValue<string | null | undefined>;
            export type messagesWithAnswersNonRequired = (model: Models.User, args: {}, context: IUserStateMachineContext, info: ResolveInfo) => PromiseOrValue<ReadonlyArray<ReadonlyArray<Models.Message | null | undefined> | null | undefined> | null | undefined>;
            export type messagesWithAnswersRequired = (model: Models.User, args: {}, context: IUserStateMachineContext, info: ResolveInfo) => PromiseOrValue<ReadonlyArray<ReadonlyArray<Models.Message | null | undefined> | null | undefined>>;
            export type messagesWithAnswersAllRequired = (model: Models.User, args: {}, context: IUserStateMachineContext, info: ResolveInfo) => PromiseOrValue<ReadonlyArray<ReadonlyArray<Models.Message>>>;
            export type messagesNonRequired = (model: Models.User, args: {}, context: IUserStateMachineContext, info: ResolveInfo) => PromiseOrValue<ReadonlyArray<Models.Message | null | undefined> | null | undefined>;
            export type messagesWithArrayRequired = (model: Models.User, args: {}, context: IUserStateMachineContext, info: ResolveInfo) => PromiseOrValue<ReadonlyArray<Models.Message | null | undefined>>;
            export type messagesRequired = (model: Models.User, args: {}, context: IUserStateMachineContext, info: ResolveInfo) => PromiseOrValue<ReadonlyArray<Models.Message>>;
            export type messagesOnlyMessageRequired = (model: Models.User, args: {}, context: IUserStateMachineContext, info: ResolveInfo) => PromiseOrValue<ReadonlyArray<Models.Message> | null | undefined>;
            export type post = (model: Models.User, args: {}, context: IPostStateMachineContext, info: ResolveInfo) => PromiseOrValue<Models.Post | null | undefined>;
            export type postRequired = (model: Models.User, args: {}, context: IUserStateMachineContext, info: ResolveInfo) => PromiseOrValue<Models.Post>;
            export type avatar = (model: Models.User, args: {}, context: IUserStateMachineContext, info: ResolveInfo) => PromiseOrValue<NSMsteamsPackagesTestModels.Avatar | null | undefined>;
            export type avatarRequired = (model: Models.User, args: {}, context: IUserStateMachineContext, info: ResolveInfo) => PromiseOrValue<NSMsteamsPackagesTestModels.Avatar>;
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
      const { resolvers, models, enums, inputs, contextMappingOutput } =
        runGenerateTest(graphql`
          type User {
            id: ID!
          }

          extend type Subscription {
            userUpdated: User!
          }
        `);
      expect(enums).toMatchInlineSnapshot(`undefined`);
      expect(contextMappingOutput).toMatchInlineSnapshot(`{}`);
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
      const { resolvers, models, enums, inputs, contextMappingOutput } =
        runGenerateTest(graphql`
          type User {
            id: ID!
          }

          extend type Query {
            users: [User!]!
          }
        `);
      expect(enums).toMatchInlineSnapshot(`undefined`);
      expect(contextMappingOutput).toMatchInlineSnapshot(`{}`);
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
      const { resolvers, models, enums, inputs, contextMappingOutput } =
        runGenerateTest(
          graphql`
            interface Node @context(uses: { managers: ["node"] }) {
              id: ID!
            }

            interface Persona @context(uses: { managers: ["persona"] }) {
              phone: String!
            }

            interface User implements Node & Persona {
              id: ID!
              name: String!
            }

            type Admin implements Node & Persona
              @context(uses: { managers: ["admin"] }) {
              id: ID!
              rank: Int!
            }

            extend type Query {
              users: [User]
              admins: [Admin]
            }
          `,
          {
            contextSubTypeMetadata,
          },
        );
      expect(enums).toMatchInlineSnapshot(`undefined`);
      expect(contextMappingOutput).toMatchInlineSnapshot(`
        {
          "Admin": {
            "__context": [
              "admin",
            ],
          },
          "Node": {
            "__context": [
              "node",
            ],
          },
          "Persona": {
            "__context": [
              "persona",
            ],
          },
        }
      `);
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
        import type { INodeStateMachineContext } from "@msteams/core-cdl-sync-node";
        import type { IPersonaStateMachineContext } from "@msteams/core-cdl-sync-persona";
        import type { IAdminStateMachineContext } from "@msteams/core-cdl-sync-admin";
        export declare namespace Node {
            export interface Resolvers {
                readonly __resolveType?: __resolveType;
            }
            export type __resolveType = (parent: unknown, context: INodeStateMachineContext, info: ResolveInfo) => PromiseOrValue<string | null>;
        }
        export declare namespace Persona {
            export interface Resolvers {
                readonly __resolveType?: __resolveType;
            }
            export type __resolveType = (parent: unknown, context: IPersonaStateMachineContext, info: ResolveInfo) => PromiseOrValue<string | null>;
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
            export type id = (model: Models.Admin, args: {}, context: IAdminStateMachineContext, info: ResolveInfo) => PromiseOrValue<string>;
            export type rank = (model: Models.Admin, args: {}, context: IAdminStateMachineContext, info: ResolveInfo) => PromiseOrValue<number>;
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
        "import type { models as NSMsteamsPackagesTestModels } from "@msteams/packages-test";
        // Base type for all models. Enables automatic resolution of abstract GraphQL types (interfaces, unions)
        export interface BaseModel {
            readonly __typename?: string;
        }
        export interface Post extends BaseModel {
            readonly __typename?: "Post";
            readonly id: string;
            readonly user: NSMsteamsPackagesTestModels.User;
        }
        "
      `);
    });

    test("implements -> @context in interfaces should be used only in resolveType", () => {
      const { resolvers, models, enums, inputs, contextMappingOutput } =
        runGenerateTest(
          graphql`
            interface Node @context(uses: { managers: ["node"] }) {
              id: ID!
            }

            interface Customer implements Node
              @context(uses: { managers: ["customer"] }) {
              id: ID!
              name: String!
            }

            type User implements Node & Customer {
              id: ID!
              name: String!
            }

            extend type Query {
              users: [User]
            }
          `,
          {
            contextSubTypeMetadata,
          },
        );
      expect(enums).toMatchInlineSnapshot(`undefined`);
      expect(contextMappingOutput).toMatchInlineSnapshot(`
        {
          "Customer": {
            "__context": [
              "customer",
            ],
          },
          "Node": {
            "__context": [
              "node",
            ],
          },
        }
      `);
      expect(inputs).toMatchInlineSnapshot(`undefined`);
      expect(models).toMatchInlineSnapshot(`
        "// Base type for all models. Enables automatic resolution of abstract GraphQL types (interfaces, unions)
        export interface BaseModel {
            readonly __typename?: string;
        }
        export interface Node extends BaseModel {
            readonly __typename?: string;
        }
        export interface Customer extends BaseModel, Node {
            readonly __typename?: string;
        }
        export interface User extends BaseModel, Node, Customer {
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
        import type { INodeStateMachineContext } from "@msteams/core-cdl-sync-node";
        import type { ICustomerStateMachineContext } from "@msteams/core-cdl-sync-customer";
        export declare namespace Node {
            export interface Resolvers {
                readonly __resolveType?: __resolveType;
            }
            export type __resolveType = (parent: unknown, context: INodeStateMachineContext, info: ResolveInfo) => PromiseOrValue<string | null>;
        }
        export declare namespace Customer {
            export interface Resolvers {
                readonly __resolveType?: __resolveType;
            }
            export type __resolveType = (parent: unknown, context: ICustomerStateMachineContext, info: ResolveInfo) => PromiseOrValue<string | null>;
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

    test("applying @context to enum shouldn't affect anything", () => {
      const { resolvers, models, enums, inputs, contextMappingOutput } =
        runGenerateTest(
          graphql`
            enum PresenceAvailability
              @context(uses: { managers: ["shouldnt-apply"] }) {
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
          { contextSubTypeMetadata },
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
      expect(contextMappingOutput).toMatchInlineSnapshot(`{}`);
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
      const { resolvers, models, enums, inputs, contextMappingOutput } =
        runGenerateTest(
          graphql`
            type Customer {
              id: ID!
            }

            type Company {
              id: ID!
            }

            type Admin @context(uses: { managers: ["admin"] }) {
              id: ID!
            }

            type User @context(uses: { managers: ["user"] }) {
              id: ID!
            }

            interface Node {
              id: ID!
            }

            union UserOrAdmin = User | Admin
            union UserOrCustomer
              @context(uses: { managers: ["user-or-customer"] }) =
                User
              | Customer
            union CompanyOrCustomer
              @context(uses: { managers: ["company-or-customer"] }) =
                Company
              | Customer

            extend type Query {
              userById(id: ID!): whatever
                @context(uses: { managers: ["whatever"] })
              userByMail(mail: String): whatever
                @context(uses: { managers: ["different-whatever"] })
              node(id: ID!): Node
            }
          `,
          {
            contextSubTypeMetadata,
          },
        );
      expect(enums).toMatchInlineSnapshot(`undefined`);
      expect(contextMappingOutput).toMatchInlineSnapshot(`
        {
          "Admin": {
            "__context": [
              "admin",
            ],
          },
          "CompanyOrCustomer": {
            "__context": [
              "company-or-customer",
            ],
          },
          "Query": {
            "userById": [
              "whatever",
            ],
            "userByMail": [
              "different-whatever",
            ],
          },
          "User": {
            "__context": [
              "user",
            ],
          },
          "UserOrCustomer": {
            "__context": [
              "user-or-customer",
            ],
          },
        }
      `);
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
        export interface Company extends BaseModel {
            readonly __typename?: "Company";
            readonly id: string;
        }
        export interface Admin extends BaseModel {
            readonly __typename?: "Admin";
            readonly id: string;
        }
        export interface User extends BaseModel {
            readonly __typename?: "User";
            readonly id: string;
        }
        export interface Node extends BaseModel {
            readonly __typename?: string;
        }
        export type UserOrAdmin = User | Admin;
        export type UserOrCustomer = User | Customer;
        export type CompanyOrCustomer = Company | Customer;
        "
      `);
      expect(resolvers).toMatchInlineSnapshot(`
        "import type { PromiseOrValue } from "@graphitation/supermassive";
        import type { ResolveInfo } from "@graphitation/supermassive";
        import * as Models from "./models.interface";
        import type { IAdminStateMachineContext } from "@msteams/core-cdl-sync-admin";
        import type { IUserStateMachineContext } from "@msteams/core-cdl-sync-user";
        import type { IUserOrCustomerStateMachineContext } from "@msteams/core-cdl-sync-user-or-customer";
        import type { ICompanyOrCustomerStateMachineContext } from "@msteams/core-cdl-sync-company-or-customer";
        import type { IWhateverStateMachineContext } from "@msteams/core-cdl-sync-whatever";
        import type { IDifferentWhateverStateMachineContext } from "@msteams/core-cdl-sync-different-whatever";
        export declare namespace Customer {
            export interface Resolvers {
                readonly id?: id;
            }
            export type id = (model: Models.Customer, args: {}, context: unknown, info: ResolveInfo) => PromiseOrValue<string>;
        }
        export declare namespace Company {
            export interface Resolvers {
                readonly id?: id;
            }
            export type id = (model: Models.Company, args: {}, context: unknown, info: ResolveInfo) => PromiseOrValue<string>;
        }
        export declare namespace Admin {
            export interface Resolvers {
                readonly id?: id;
            }
            export type id = (model: Models.Admin, args: {}, context: IAdminStateMachineContext, info: ResolveInfo) => PromiseOrValue<string>;
        }
        export declare namespace User {
            export interface Resolvers {
                readonly id?: id;
            }
            export type id = (model: Models.User, args: {}, context: IUserStateMachineContext, info: ResolveInfo) => PromiseOrValue<string>;
        }
        export declare namespace Node {
            export interface Resolvers {
                readonly __resolveType?: __resolveType;
            }
            export type __resolveType = (parent: unknown, context: unknown, info: ResolveInfo) => PromiseOrValue<string | null>;
        }
        export declare namespace UserOrAdmin {
            export interface Resolvers {
                readonly __resolveType?: __resolveType;
            }
            export type __resolveType = (parent: Models.User | Models.Admin, context: unknown, info: ResolveInfo) => PromiseOrValue<"User" | "Admin" | null>;
        }
        export declare namespace UserOrCustomer {
            export interface Resolvers {
                readonly __resolveType?: __resolveType;
            }
            export type __resolveType = (parent: Models.User | Models.Customer, context: IUserOrCustomerStateMachineContext, info: ResolveInfo) => PromiseOrValue<"User" | "Customer" | null>;
        }
        export declare namespace CompanyOrCustomer {
            export interface Resolvers {
                readonly __resolveType?: __resolveType;
            }
            export type __resolveType = (parent: Models.Company | Models.Customer, context: ICompanyOrCustomerStateMachineContext, info: ResolveInfo) => PromiseOrValue<"Company" | "Customer" | null>;
        }
        export declare namespace Query {
            export interface Resolvers {
                readonly userById?: userById;
                readonly userByMail?: userByMail;
                readonly node?: node;
            }
            export type userById = (model: unknown, args: {
                readonly id: string;
            }, context: IWhateverStateMachineContext, info: ResolveInfo) => PromiseOrValue<Models.whatever | null | undefined>;
            export type userByMail = (model: unknown, args: {
                readonly mail?: string | null;
            }, context: IDifferentWhateverStateMachineContext, info: ResolveInfo) => PromiseOrValue<Models.whatever | null | undefined>;
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
    defaultContextTypePath?: string;
    contextName?: string;
    legacyCompat?: boolean;
    enumsImport?: string;
    legacyNoModelsForObjects?: boolean;
    useStringUnionsInsteadOfEnums?: boolean;
    modelScope?: string;
    contextSubTypeMetadata?: SubTypeNamespace;
  } = {},
): {
  enums?: string;
  inputs?: string;
  models: string;
  resolvers: string;
  legacyTypes?: string;
  legacyResolvers?: string;
  legacyNoModelsForObjects?: boolean;
  useStringUnionsInsteadOfEnums?: boolean;
  modelScope?: string;
  contextMappingOutput: ContextMap | null;
} {
  const fullOptions: {
    outputPath: string;
    documentPath: string;
    defaultContextTypePath?: string | null;
    contextName?: string;
    legacyCompat?: boolean;
    legacyNoModelsForObjects?: boolean;
    useStringUnionsInsteadOfEnums?: boolean;
  } = {
    outputPath: "__generated__",
    documentPath: "./typedef.graphql",
    ...options,
  };
  const document = parse(doc);
  const { files, contextMappingOutput } = generateTS(document, fullOptions);

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
    contextMappingOutput,
  };
}
