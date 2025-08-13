import ts from "typescript";
import { parse } from "graphql";
import { blankGraphQLTag as graphql } from "../utilities";
import { generateTS } from "..";
import { SubTypeNamespace } from "../codegen";
import { OutputMetadata } from "../context/utilities";

describe(generateTS, () => {
  describe("Tests basic syntax GraphQL syntax", () => {
    const contextTypeExtensions = {
      baseContextTypePath: "@package/default-context",
      baseContextTypeName: "DefaultContextType",
      legacyBaseContextTypePath: "@package/default-context",
      legacyBaseContextTypeName: "DefaultLegacyContextType",
      groups: {
        baseContextOnly: {},
        UserTestGroup: {
          managers: ["user", "whatever"],
        },
        PostTestGroup: {
          managers: ["post", "whatever"],
          workflows: ["post-workflow"],
        },
      },
      contextTypes: {
        managers: {
          user: {
            importNamespaceName: "UserStateMachineType",
            importPath: "@package/user-state-machine",
            typeName: 'UserStateMachineType["user"]',
          },
          secondUser: {
            importNamespaceName: "SecondUserStateMachineType",
            importPath: "@package/user-state-machine",
            typeName: 'UserStateMachineType["secondUser"]',
          },
          whatever: {
            importPath: "@package/whatever-state-machine",
            typeName: "whatever",
          },
          "different-whatever": {
            importNamespaceName: "DifferentWhateverStateMachineType",
            importPath: "@package/different-whatever-state-machine",
            typeName:
              'DifferentWhateverStateMachineType["managers"]["different-whatever"]',
          },
          post: {
            importNamespaceName: "PostStateMachineType",
            importPath: "@package/post-state-machine",
            typeName: 'PostStateMachineType["post"]',
          },
          node: {
            importNamespaceName: "NodeStateMachineType",
            importPath: "@package/node-state-machine",
            typeName: 'NodeStateMachineType["node"]',
          },
          persona: {
            importNamespaceName: "PersonaStateMachineType",
            importPath: "@package/persona-state-machine",
            typeName: 'PersonaStateMachineType["managers"]["persona"]',
          },
          admin: {
            importNamespaceName: "AdminStateMachineType",
            importPath: "@package/admin-state-machine",
            typeName: 'AdminStateMachineType["managers"]["admin"]',
          },
          message: {
            importNamespaceName: "MessageStateMachineType",
            importPath: "@package/message-state-machine",
            typeName: 'MessageStateMachineType["message"]',
          },
          customer: {
            importNamespaceName: "CustomerStateMachineType",
            importPath: "@package/customer-state-machine",
            typeName: 'CustomerStateMachineType["customer"]',
          },
          "shouldnt-apply": {
            importNamespaceName: "UserStateMachineType",
            importPath: "@package/shouldnt-apply-state-machine",
            typeName: 'UserStateMachineType["managers"]["shouldnt-apply"]',
          },
          "user-or-customer": {
            importNamespaceName: "UserStateMachineType",
            importPath: "@package/user-or-customer-state-machine",
            typeName: 'UserStateMachineType["user-or-customer"]',
          },
          "company-or-customer": {
            importNamespaceName: "UserStateMachineType",
            importPath: "@package/company-or-customer-state-machine",
            typeName: 'UserStateMachineType["managers"]["company-or-customer"]',
          },
          "id-user": {
            importNamespaceName: "UserStateMachineType",
            importPath: "@package/id-user-state-machine",
            typeName: 'UserStateMachineType["id-user"]',
          },
        },
        workflows: {
          "post-workflow": {
            importNamespaceName: "PostStateMachineType",
            importPath: "@package/post-state-machine",
            typeName: 'PostStateMachineType["post-workflow"]',
          },
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
              author: User @context(required: { managers: ["secondUser"] })
            }

            type Message {
              id: ID! @context(required: { managers: ["message"] })
            }

            type User @context(required: { managers: ["user"] }) {
              id: ID! @context(required: { managers: ["id-user", "user"] })
              name: String
              messagesWithAnswersNonRequired: [[Message]]
              messagesWithAnswersRequired: [[Message]]!
              messagesWithAnswersAllRequired: [[Message!]!]!
              messagesNonRequired: [Message]
              messagesWithArrayRequired: [Message]!
              messagesRequired: [Message!]!
              messagesOnlyMessageRequired: [Message!]
              post: Post
                @context(required: { managers: ["post"] }, useLegacy: true)
              postRequired: Post!
              avatar: Avatar
                @context(
                  required: { managers: ["user"] }
                  optional: { managers: ["node"] }
                )
              avatarRequired: Avatar! @context(optional: { managers: ["node"] })
            }

            extend type Query {
              requiredUsers: [User!]! @UserTestGroup
              optionalUsers: [User] @UserTestGroup
              optionalUser: User
                @context(
                  required: { managers: ["user"] }
                  optional: { managers: ["node"] }
                  useLegacy: true
                )
              requiredUser: User! @context(optional: { managers: ["node"] })
              requiredPost: Post! @baseContextOnly
              optionalPost: Post @PostTestGroup
            }
          `,
          {
            contextTypeExtensions: contextTypeExtensions,
          },
        );
      expect(enums).toMatchInlineSnapshot(`undefined`);
      expect(contextMappingOutput).toMatchInlineSnapshot(`
        {
          "Message": {
            "id": {
              "managers": [
                "message",
              ],
            },
          },
          "Post": {
            "author": {
              "managers": [
                "secondUser",
              ],
            },
          },
          "Query": {
            "optionalPost": {
              "managers": [
                "post",
                "whatever",
              ],
              "workflows": [
                "post-workflow",
              ],
            },
            "optionalUser": {
              "managers": [
                "user",
                "node",
              ],
            },
            "optionalUsers": {
              "managers": [
                "user",
                "whatever",
              ],
            },
            "requiredUser": {
              "managers": [
                "node",
              ],
            },
            "requiredUsers": {
              "managers": [
                "user",
                "whatever",
              ],
            },
          },
          "User": {
            "avatar": {
              "managers": [
                "user",
                "node",
              ],
            },
            "avatarRequired": {
              "managers": [
                "node",
              ],
            },
            "id": {
              "managers": [
                "id-user",
                "user",
              ],
            },
            "messagesNonRequired": {
              "managers": [
                "user",
              ],
            },
            "messagesOnlyMessageRequired": {
              "managers": [
                "user",
              ],
            },
            "messagesRequired": {
              "managers": [
                "user",
              ],
            },
            "messagesWithAnswersAllRequired": {
              "managers": [
                "user",
              ],
            },
            "messagesWithAnswersNonRequired": {
              "managers": [
                "user",
              ],
            },
            "messagesWithAnswersRequired": {
              "managers": [
                "user",
              ],
            },
            "messagesWithArrayRequired": {
              "managers": [
                "user",
              ],
            },
            "name": {
              "managers": [
                "user",
              ],
            },
            "post": {
              "managers": [
                "post",
              ],
            },
            "postRequired": {
              "managers": [
                "user",
              ],
            },
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
        import type { PromiseOrValue, IterableOrAsyncIterable } from "@graphitation/supermassive";
        import type { ResolveInfo } from "@graphitation/supermassive";
        import * as Models from "./models.interface";
        import type { SecondUserStateMachineType, UserStateMachineType } from "@package/user-state-machine";
        import type { MessageStateMachineType } from "@package/message-state-machine";
        import type { PostStateMachineType } from "@package/post-state-machine";
        import type { NodeStateMachineType } from "@package/node-state-machine";
        import type { whatever } from "@package/whatever-state-machine";
        import type { DefaultContextType, DefaultLegacyContextType } from "@package/default-context";
        export declare namespace Post {
            export interface Resolvers {
                readonly id?: id;
                readonly author?: author;
            }
            export type id = (model: Models.Post, args: {}, context: unknown, info: ResolveInfo) => PromiseOrValue<string>;
            export type author = (model: Models.Post, args: {}, context: DefaultContextType & {
                managers: {
                    "secondUser": UserStateMachineType["secondUser"];
                };
            }, info: ResolveInfo) => PromiseOrValue<Models.User | null | undefined>;
        }
        export declare namespace Message {
            export interface Resolvers {
                readonly id?: id;
            }
            export type id = (model: Models.Message, args: {}, context: DefaultContextType & {
                managers: {
                    "message": MessageStateMachineType["message"];
                };
            }, info: ResolveInfo) => PromiseOrValue<string>;
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
            export type id = (model: Models.User, args: {}, context: DefaultContextType & {
                managers: {
                    "id-user": UserStateMachineType["id-user"];
                    "user": UserStateMachineType["user"];
                };
            }, info: ResolveInfo) => PromiseOrValue<string>;
            export type name = (model: Models.User, args: {}, context: DefaultContextType & {
                managers: {
                    "user": UserStateMachineType["user"];
                };
            }, info: ResolveInfo) => PromiseOrValue<string | null | undefined>;
            export type messagesWithAnswersNonRequired = (model: Models.User, args: {}, context: DefaultContextType & {
                managers: {
                    "user": UserStateMachineType["user"];
                };
            }, info: ResolveInfo) => PromiseOrValue<IterableOrAsyncIterable<IterableOrAsyncIterable<Models.Message | null | undefined> | null | undefined> | null | undefined>;
            export type messagesWithAnswersRequired = (model: Models.User, args: {}, context: DefaultContextType & {
                managers: {
                    "user": UserStateMachineType["user"];
                };
            }, info: ResolveInfo) => PromiseOrValue<IterableOrAsyncIterable<IterableOrAsyncIterable<Models.Message | null | undefined> | null | undefined>>;
            export type messagesWithAnswersAllRequired = (model: Models.User, args: {}, context: DefaultContextType & {
                managers: {
                    "user": UserStateMachineType["user"];
                };
            }, info: ResolveInfo) => PromiseOrValue<IterableOrAsyncIterable<IterableOrAsyncIterable<Models.Message>>>;
            export type messagesNonRequired = (model: Models.User, args: {}, context: DefaultContextType & {
                managers: {
                    "user": UserStateMachineType["user"];
                };
            }, info: ResolveInfo) => PromiseOrValue<IterableOrAsyncIterable<Models.Message | null | undefined> | null | undefined>;
            export type messagesWithArrayRequired = (model: Models.User, args: {}, context: DefaultContextType & {
                managers: {
                    "user": UserStateMachineType["user"];
                };
            }, info: ResolveInfo) => PromiseOrValue<IterableOrAsyncIterable<Models.Message | null | undefined>>;
            export type messagesRequired = (model: Models.User, args: {}, context: DefaultContextType & {
                managers: {
                    "user": UserStateMachineType["user"];
                };
            }, info: ResolveInfo) => PromiseOrValue<IterableOrAsyncIterable<Models.Message>>;
            export type messagesOnlyMessageRequired = (model: Models.User, args: {}, context: DefaultContextType & {
                managers: {
                    "user": UserStateMachineType["user"];
                };
            }, info: ResolveInfo) => PromiseOrValue<IterableOrAsyncIterable<Models.Message> | null | undefined>;
            export type post = (model: Models.User, args: {}, context: DefaultLegacyContextType & {
                managers: {
                    "post": PostStateMachineType["post"];
                };
            }, info: ResolveInfo) => PromiseOrValue<Models.Post | null | undefined>;
            export type postRequired = (model: Models.User, args: {}, context: DefaultContextType & {
                managers: {
                    "user": UserStateMachineType["user"];
                };
            }, info: ResolveInfo) => PromiseOrValue<Models.Post>;
            export type avatar = (model: Models.User, args: {}, context: DefaultContextType & {
                managers: {
                    "user": UserStateMachineType["user"];
                    "node"?: NodeStateMachineType["node"];
                };
            }, info: ResolveInfo) => PromiseOrValue<NSMsteamsPackagesTestModels.Avatar | null | undefined>;
            export type avatarRequired = (model: Models.User, args: {}, context: DefaultContextType & {
                managers: {
                    "node"?: NodeStateMachineType["node"];
                };
            }, info: ResolveInfo) => PromiseOrValue<NSMsteamsPackagesTestModels.Avatar>;
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
            export type requiredUsers = (model: unknown, args: {}, context: DefaultContextType & {
                managers: {
                    "user": UserStateMachineType["user"];
                    "whatever": whatever;
                };
            }, info: ResolveInfo) => PromiseOrValue<IterableOrAsyncIterable<Models.User>>;
            export type optionalUsers = (model: unknown, args: {}, context: DefaultContextType & {
                managers: {
                    "user": UserStateMachineType["user"];
                    "whatever": whatever;
                };
            }, info: ResolveInfo) => PromiseOrValue<IterableOrAsyncIterable<Models.User | null | undefined> | null | undefined>;
            export type optionalUser = (model: unknown, args: {}, context: DefaultLegacyContextType & {
                managers: {
                    "user": UserStateMachineType["user"];
                    "node"?: NodeStateMachineType["node"];
                };
            }, info: ResolveInfo) => PromiseOrValue<Models.User | null | undefined>;
            export type requiredUser = (model: unknown, args: {}, context: DefaultContextType & {
                managers: {
                    "node"?: NodeStateMachineType["node"];
                };
            }, info: ResolveInfo) => PromiseOrValue<Models.User>;
            export type requiredPost = (model: unknown, args: {}, context: DefaultContextType, info: ResolveInfo) => PromiseOrValue<Models.Post>;
            export type optionalPost = (model: unknown, args: {}, context: DefaultContextType & {
                managers: {
                    "post": PostStateMachineType["post"];
                    "whatever": whatever;
                };
                workflows: {
                    "post-workflow": PostStateMachineType["post-workflow"];
                };
            }, info: ResolveInfo) => PromiseOrValue<Models.Post | null | undefined>;
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
                subscribe: (model: unknown, args: {}, context: unknown, info: ResolveInfo) => PromiseOrValue<AsyncIterable<{
                    userUpdated: Models.User;
                }>>;
            } | {
                subscribe: (model: unknown, args: {}, context: unknown, info: ResolveInfo) => PromiseOrValue<AsyncIterable<SubscribeResult>>;
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
                subscribe: (model: unknown, args: {}, context: unknown, info: ResolveInfo) => PromiseOrValue<AsyncIterable<{
                    userUpdated: Models.User;
                }>>;
            } | {
                subscribe: (model: unknown, args: {}, context: unknown, info: ResolveInfo) => PromiseOrValue<AsyncIterable<SubscribeResult>>;
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
        "import type { PromiseOrValue, IterableOrAsyncIterable } from "@graphitation/supermassive";
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
            export type users = (model: unknown, args: {}, context: unknown, info: ResolveInfo) => PromiseOrValue<IterableOrAsyncIterable<Models.User>>;
        }
        "
      `);
    });
    test("case when interface implements multiple interfaces", () => {
      const { resolvers, models, enums, inputs, contextMappingOutput } =
        runGenerateTest(
          graphql`
            interface Node @context(required: { managers: ["node"] }) {
              id: ID!
            }

            interface Persona @context(required: { managers: ["persona"] }) {
              phone: String!
            }

            interface User implements Node & Persona {
              id: ID!
              name: String!
            }

            type Admin implements Node & Persona
              @context(required: { managers: ["admin"] }) {
              id: ID!
              rank: Int!
            }

            extend type Query {
              users: [User]
              admins: [Admin]
            }
          `,
          {
            contextTypeExtensions: {
              contextTypes: contextTypeExtensions.contextTypes,
            },
          },
        );
      expect(enums).toMatchInlineSnapshot(`undefined`);
      expect(contextMappingOutput).toMatchInlineSnapshot(`
        {
          "Admin": {
            "id": {
              "managers": [
                "admin",
              ],
            },
            "rank": {
              "managers": [
                "admin",
              ],
            },
          },
          "Node": {
            "managers": [
              "node",
            ],
          },
          "Persona": {
            "managers": [
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
        "import type { PromiseOrValue, IterableOrAsyncIterable } from "@graphitation/supermassive";
        import type { ResolveInfo } from "@graphitation/supermassive";
        import * as Models from "./models.interface";
        import type { NodeStateMachineType } from "@package/node-state-machine";
        import type { PersonaStateMachineType } from "@package/persona-state-machine";
        import type { AdminStateMachineType } from "@package/admin-state-machine";
        export declare namespace Node {
            export interface Resolvers {
                readonly __resolveType?: __resolveType;
            }
            export type __resolveType = (parent: unknown, context: {
                managers: {
                    "node": NodeStateMachineType["node"];
                };
            }, info: ResolveInfo) => PromiseOrValue<string | null>;
        }
        export declare namespace Persona {
            export interface Resolvers {
                readonly __resolveType?: __resolveType;
            }
            export type __resolveType = (parent: unknown, context: {
                managers: {
                    "persona": PersonaStateMachineType["managers"]["persona"];
                };
            }, info: ResolveInfo) => PromiseOrValue<string | null>;
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
            export type id = (model: Models.Admin, args: {}, context: {
                managers: {
                    "admin": AdminStateMachineType["managers"]["admin"];
                };
            }, info: ResolveInfo) => PromiseOrValue<string>;
            export type rank = (model: Models.Admin, args: {}, context: {
                managers: {
                    "admin": AdminStateMachineType["managers"]["admin"];
                };
            }, info: ResolveInfo) => PromiseOrValue<number>;
        }
        export declare namespace Query {
            export interface Resolvers {
                readonly users?: users;
                readonly admins?: admins;
            }
            export type users = (model: unknown, args: {}, context: unknown, info: ResolveInfo) => PromiseOrValue<IterableOrAsyncIterable<Models.User | null | undefined> | null | undefined>;
            export type admins = (model: unknown, args: {}, context: unknown, info: ResolveInfo) => PromiseOrValue<IterableOrAsyncIterable<Models.Admin | null | undefined> | null | undefined>;
        }
        "
      `);
    });
    test("it doesn't use context at all due to the missing input file", () => {
      const { resolvers, models, enums, inputs, contextMappingOutput } =
        runGenerateTest(
          graphql`
            interface Node @context(required: { managers: ["node"] }) {
              id: ID!
            }

            interface Persona @context(required: { managers: ["persona"] }) {
              phone: String!
            }

            interface User implements Node & Persona {
              id: ID!
              name: String!
            }

            type Admin implements Node & Persona
              @context(required: { managers: ["admin"] }) {
              id: ID!
              rank: Int!
            }

            extend type Query {
              users: [User]
              admins: [Admin]
            }
          `,
          {},
        );
      expect(enums).toMatchInlineSnapshot(`undefined`);
      expect(contextMappingOutput).toMatchInlineSnapshot(`{}`);
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
        "import type { PromiseOrValue, IterableOrAsyncIterable } from "@graphitation/supermassive";
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
            export type users = (model: unknown, args: {}, context: unknown, info: ResolveInfo) => PromiseOrValue<IterableOrAsyncIterable<Models.User | null | undefined> | null | undefined>;
            export type admins = (model: unknown, args: {}, context: unknown, info: ResolveInfo) => PromiseOrValue<IterableOrAsyncIterable<Models.Admin | null | undefined> | null | undefined>;
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
            interface Node @context(required: { managers: ["node"] }) {
              id: ID!
            }

            interface Customer implements Node
              @context(required: { managers: ["customer"] }) {
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
            contextTypeExtensions: {
              contextTypes: contextTypeExtensions.contextTypes,
            },
          },
        );
      expect(enums).toMatchInlineSnapshot(`undefined`);
      expect(contextMappingOutput).toMatchInlineSnapshot(`
        {
          "Customer": {
            "managers": [
              "customer",
            ],
          },
          "Node": {
            "managers": [
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
        "import type { PromiseOrValue, IterableOrAsyncIterable } from "@graphitation/supermassive";
        import type { ResolveInfo } from "@graphitation/supermassive";
        import * as Models from "./models.interface";
        import type { NodeStateMachineType } from "@package/node-state-machine";
        import type { CustomerStateMachineType } from "@package/customer-state-machine";
        export declare namespace Node {
            export interface Resolvers {
                readonly __resolveType?: __resolveType;
            }
            export type __resolveType = (parent: unknown, context: {
                managers: {
                    "node": NodeStateMachineType["node"];
                };
            }, info: ResolveInfo) => PromiseOrValue<string | null>;
        }
        export declare namespace Customer {
            export interface Resolvers {
                readonly __resolveType?: __resolveType;
            }
            export type __resolveType = (parent: unknown, context: {
                managers: {
                    "customer": CustomerStateMachineType["customer"];
                };
            }, info: ResolveInfo) => PromiseOrValue<string | null>;
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
            export type users = (model: unknown, args: {}, context: unknown, info: ResolveInfo) => PromiseOrValue<IterableOrAsyncIterable<Models.User | null | undefined> | null | undefined>;
        }
        "
      `);
    });

    test("applying @context to enum shouldn't affect anything", () => {
      const { resolvers, models, enums, inputs, contextMappingOutput } =
        runGenerateTest(
          graphql`
            enum PresenceAvailability
              @context(required: { managers: ["shouldnt-apply"] }) {
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
          { contextTypeExtensions },
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

            type Admin @context(required: { managers: ["admin"] }) {
              id: ID!
            }

            type User @context(required: { managers: ["user"] }) {
              id: ID!
            }

            interface Node {
              id: ID!
            }

            union UserOrAdmin = User | Admin
            union UserOrCustomer
              @context(required: { managers: ["user-or-customer"] }) =
                User
              | Customer
            union CompanyOrCustomer
              @context(required: { managers: ["company-or-customer"] }) =
                Company
              | Customer

            extend type Query {
              userById(id: ID!): whatever
                @context(required: { managers: ["whatever"] })
              userByMail(mail: String): whatever
                @context(required: { managers: ["different-whatever"] })
              node(id: ID!): Node
            }
          `,
          {
            contextTypeExtensions: {
              contextTypes: contextTypeExtensions.contextTypes,
            },
          },
        );
      expect(enums).toMatchInlineSnapshot(`undefined`);
      expect(contextMappingOutput).toMatchInlineSnapshot(`
        {
          "Admin": {
            "id": {
              "managers": [
                "admin",
              ],
            },
          },
          "CompanyOrCustomer": {
            "managers": [
              "company-or-customer",
            ],
          },
          "Query": {
            "userById": {
              "managers": [
                "whatever",
              ],
            },
            "userByMail": {
              "managers": [
                "different-whatever",
              ],
            },
          },
          "User": {
            "id": {
              "managers": [
                "user",
              ],
            },
          },
          "UserOrCustomer": {
            "managers": [
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
        import type { AdminStateMachineType } from "@package/admin-state-machine";
        import type { UserStateMachineType } from "@package/user-state-machine";
        import type { whatever } from "@package/whatever-state-machine";
        import type { DifferentWhateverStateMachineType } from "@package/different-whatever-state-machine";
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
            export type id = (model: Models.Admin, args: {}, context: {
                managers: {
                    "admin": AdminStateMachineType["managers"]["admin"];
                };
            }, info: ResolveInfo) => PromiseOrValue<string>;
        }
        export declare namespace User {
            export interface Resolvers {
                readonly id?: id;
            }
            export type id = (model: Models.User, args: {}, context: {
                managers: {
                    "user": UserStateMachineType["user"];
                };
            }, info: ResolveInfo) => PromiseOrValue<string>;
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
            export type __resolveType = (parent: Models.User | Models.Customer, context: {
                managers: {
                    "user-or-customer": UserStateMachineType["user-or-customer"];
                };
            }, info: ResolveInfo) => PromiseOrValue<"User" | "Customer" | null>;
        }
        export declare namespace CompanyOrCustomer {
            export interface Resolvers {
                readonly __resolveType?: __resolveType;
            }
            export type __resolveType = (parent: Models.Company | Models.Customer, context: {
                managers: {
                    "company-or-customer": UserStateMachineType["managers"]["company-or-customer"];
                };
            }, info: ResolveInfo) => PromiseOrValue<"Company" | "Customer" | null>;
        }
        export declare namespace Query {
            export interface Resolvers {
                readonly userById?: userById;
                readonly userByMail?: userByMail;
                readonly node?: node;
            }
            export type userById = (model: unknown, args: {
                readonly id: string;
            }, context: {
                managers: {
                    "whatever": whatever;
                };
            }, info: ResolveInfo) => PromiseOrValue<Models.whatever | null | undefined>;
            export type userByMail = (model: unknown, args: {
                readonly mail?: string | null;
            }, context: {
                managers: {
                    "different-whatever": DifferentWhateverStateMachineType["managers"]["different-whatever"];
                };
            }, info: ResolveInfo) => PromiseOrValue<Models.whatever | null | undefined>;
            export type node = (model: unknown, args: {
                readonly id: string;
            }, context: unknown, info: ResolveInfo) => PromiseOrValue<Models.Node | null | undefined>;
        }
        "
      `);
    });

    test("enum is used as @context namespace value", () => {
      const { resolvers, models, enums, inputs, contextMappingOutput } =
        runGenerateTest(
          graphql`
            enum UserContext {
              user
            }
            type User @context(required: { managers: [user] }) {
              id: ID!
            }

            extend type Query {
              userById(id: ID!): User @context(required: { managers: [user] })
            }
          `,
          {
            contextTypeExtensions: {
              contextTypes: contextTypeExtensions.contextTypes,
            },
          },
        );
      expect(enums).toMatchInlineSnapshot(`
        "export enum UserContext {
            user = "user"
        }
        "
      `);
      expect(contextMappingOutput).toMatchInlineSnapshot(`
        {
          "Query": {
            "userById": {
              "managers": [
                "user",
              ],
            },
          },
          "User": {
            "id": {
              "managers": [
                "user",
              ],
            },
          },
        }
      `);
      expect(inputs).toMatchInlineSnapshot(`undefined`);
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
        import type { UserStateMachineType } from "@package/user-state-machine";
        export declare namespace User {
            export interface Resolvers {
                readonly id?: id;
            }
            export type id = (model: Models.User, args: {}, context: {
                managers: {
                    "user": UserStateMachineType["user"];
                };
            }, info: ResolveInfo) => PromiseOrValue<string>;
        }
        export declare namespace Query {
            export interface Resolvers {
                readonly userById?: userById;
            }
            export type userById = (model: unknown, args: {
                readonly id: string;
            }, context: {
                managers: {
                    "user": UserStateMachineType["user"];
                };
            }, info: ResolveInfo) => PromiseOrValue<Models.User | null | undefined>;
        }
        "
      `);
    });

    test("@context namespace must have the same value type", () => {
      const errorLogger = console.error;
      console.error = () => {};
      try {
        runGenerateTest(
          graphql`
            enum UserContext {
              user
            }
            type User @context(required: { managers: [user, "user-type"] }) {
              id: ID!
            }

            extend type Query {
              userById(id: ID!): User
            }
          `,
          {
            contextTypeExtensions: {
              contextTypes: contextTypeExtensions.contextTypes,
            },
          },
        );
      } catch (e) {
        expect(e).toBeInstanceOf(Error);
        expect(e).toMatchInlineSnapshot(
          `[Error: Namespace "managers" must be list of same kind values]`,
        );
      }
      console.error = errorLogger;
    });
  });
});

function runGenerateTest(
  doc: string,
  options: {
    outputPath?: string;
    documentPath?: string;
    contextName?: string;
    legacyCompat?: boolean;
    enumsImport?: string;
    legacyNoModelsForObjects?: boolean;
    useStringUnionsInsteadOfEnums?: boolean;
    enumNamesToMigrate?: string[];
    enumNamesToKeep?: string[];
    modelScope?: string;
    contextTypeExtensions?: SubTypeNamespace;
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
  enumNamesToMigrate?: string[];
  enumNamesToKeep?: string[];
  modelScope?: string;
  contextMappingOutput: OutputMetadata | null;
} {
  const fullOptions: {
    outputPath: string;
    documentPath: string;
    baseContextTypeName?: string;
    baseContextTypePath?: string;
    contextName?: string;
    legacyCompat?: boolean;
    legacyNoModelsForObjects?: boolean;
    useStringUnionsInsteadOfEnums?: boolean;
    enumNamesToMigrate?: string[];
    enumNamesToKeep?: string[];
  } = {
    outputPath: "__generated__",
    documentPath: "./typedef.graphql",
    ...options,
    baseContextTypeName: options?.contextTypeExtensions?.baseContextTypeName,
    baseContextTypePath: options?.contextTypeExtensions?.baseContextTypePath,
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
