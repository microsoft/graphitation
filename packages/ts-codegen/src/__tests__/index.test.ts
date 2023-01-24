import ts from "typescript";
import { parse } from "graphql";
import path from "path";
import { blankGraphQLTag as graphql } from "../utilities";
import { generateTS } from "..";

describe(generateTS, () => {
  describe("Tests basic syntax GraphQL syntax", () => {
    test("all possible nullable and non-nullable combinations", () => {
      const { resolvers, models } = runGenerateTest(graphql`
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
      expect(models).toMatchInlineSnapshot(`
        "import type { AvatarModel } from "@msteams/packages-test";
        import type { PostModel as _PostModel } from "../post-model.interface";
        // Base type for all models. Enables automatic resolution of abstract GraphQL types (interfaces, unions)
        export interface BaseModel {
            readonly __typename?: string;
        }
        export interface PostModel extends BaseModel, _PostModel {
            readonly __typename?: "Post";
        }
        export interface MessageModel extends BaseModel {
            readonly __typename?: "Message";
            readonly id: string;
        }
        export interface UserModel extends BaseModel {
            readonly __typename?: "User";
            readonly id: string;
            readonly name: string | null;
            readonly messagesWithAnswersNonRequired: ReadonlyArray<ReadonlyArray<MessageModel | null> | null> | null;
            readonly messagesWithAnswersRequired: ReadonlyArray<ReadonlyArray<MessageModel | null> | null>;
            readonly messagesWithAnswersAllRequired: ReadonlyArray<ReadonlyArray<MessageModel>>;
            readonly messagesNonRequired: ReadonlyArray<MessageModel | null> | null;
            readonly messagesWithArrayRequired: ReadonlyArray<MessageModel | null>;
            readonly messagesRequired: ReadonlyArray<MessageModel>;
            readonly messagesOnlyMessageRequired: ReadonlyArray<MessageModel> | null;
            readonly post: PostModel | null;
            readonly postRequired: PostModel;
            readonly avatar: AvatarModel | null;
            readonly avatarRequired: AvatarModel;
        }
        "
      `);
      expect(resolvers).toMatchInlineSnapshot(`
        "import type { PromiseOrValue } from "@graphitation/supermassive";
        import type { ResolveInfo } from "@graphitation/supermassive";
        import type { MessageModel, PostModel, UserModel } from "./models.interface";
        import type { AvatarModel } from "@msteams/packages-test";
        export declare namespace Post {
            export type id = (model: PostModel, args: {}, context: unknown, info: ResolveInfo) => PromiseOrValue<string>;
        }
        export declare namespace Message {
            export type id = (model: MessageModel, args: {}, context: unknown, info: ResolveInfo) => PromiseOrValue<string>;
        }
        export declare namespace User {
            export type id = (model: UserModel, args: {}, context: unknown, info: ResolveInfo) => PromiseOrValue<string>;
            export type name = (model: UserModel, args: {}, context: unknown, info: ResolveInfo) => PromiseOrValue<string | null>;
            export type messagesWithAnswersNonRequired = (model: UserModel, args: {}, context: unknown, info: ResolveInfo) => PromiseOrValue<ReadonlyArray<ReadonlyArray<MessageModel | null> | null> | null>;
            export type messagesWithAnswersRequired = (model: UserModel, args: {}, context: unknown, info: ResolveInfo) => PromiseOrValue<ReadonlyArray<ReadonlyArray<MessageModel | null> | null>>;
            export type messagesWithAnswersAllRequired = (model: UserModel, args: {}, context: unknown, info: ResolveInfo) => PromiseOrValue<ReadonlyArray<ReadonlyArray<MessageModel>>>;
            export type messagesNonRequired = (model: UserModel, args: {}, context: unknown, info: ResolveInfo) => PromiseOrValue<ReadonlyArray<MessageModel | null> | null>;
            export type messagesWithArrayRequired = (model: UserModel, args: {}, context: unknown, info: ResolveInfo) => PromiseOrValue<ReadonlyArray<MessageModel | null>>;
            export type messagesRequired = (model: UserModel, args: {}, context: unknown, info: ResolveInfo) => PromiseOrValue<ReadonlyArray<MessageModel>>;
            export type messagesOnlyMessageRequired = (model: UserModel, args: {}, context: unknown, info: ResolveInfo) => PromiseOrValue<ReadonlyArray<MessageModel> | null>;
            export type post = (model: UserModel, args: {}, context: unknown, info: ResolveInfo) => PromiseOrValue<PostModel | null>;
            export type postRequired = (model: UserModel, args: {}, context: unknown, info: ResolveInfo) => PromiseOrValue<PostModel>;
            export type avatar = (model: UserModel, args: {}, context: unknown, info: ResolveInfo) => PromiseOrValue<AvatarModel | null>;
            export type avatarRequired = (model: UserModel, args: {}, context: unknown, info: ResolveInfo) => PromiseOrValue<AvatarModel>;
        }
        export declare namespace Query {
            export type requiredUsers = (model: unknown, args: {}, context: unknown, info: ResolveInfo) => PromiseOrValue<ReadonlyArray<UserModel>>;
            export type optionalUsers = (model: unknown, args: {}, context: unknown, info: ResolveInfo) => PromiseOrValue<ReadonlyArray<UserModel | null> | null>;
            export type optionalUser = (model: unknown, args: {}, context: unknown, info: ResolveInfo) => PromiseOrValue<UserModel | null>;
            export type requiredUser = (model: unknown, args: {}, context: unknown, info: ResolveInfo) => PromiseOrValue<UserModel>;
            export type requiredPost = (model: unknown, args: {}, context: unknown, info: ResolveInfo) => PromiseOrValue<PostModel>;
            export type optionalPost = (model: unknown, args: {}, context: unknown, info: ResolveInfo) => PromiseOrValue<PostModel | null>;
        }
        "
      `);
    });
    test("Subscription", () => {
      const { resolvers, models } = runGenerateTest(graphql`
        type User {
          id: ID!
        }

        extend type Subscription {
          userUpdated: User!
        }
      `);
      expect(models).toMatchInlineSnapshot(`
        "// Base type for all models. Enables automatic resolution of abstract GraphQL types (interfaces, unions)
        export interface BaseModel {
            readonly __typename?: string;
        }
        export interface UserModel extends BaseModel {
            readonly __typename?: "User";
            readonly id: string;
        }
        "
      `);
      expect(resolvers).toMatchInlineSnapshot(`
        "import type { PromiseOrValue } from "@graphitation/supermassive";
        import type { ResolveInfo } from "@graphitation/supermassive";
        import type { UserModel } from "./models.interface";
        export declare namespace User {
            export type id = (model: UserModel, args: {}, context: unknown, info: ResolveInfo) => PromiseOrValue<string>;
        }
        export declare namespace Subscription {
            export type userUpdated<A = unknown> = {
                subscribe: (model: unknown, args: {}, context: unknown, info: ResolveInfo) => PromiseOrValue<AsyncIterator<A>>;
                resolve: (parent: A, args: {}, context: unknown, info: ResolveInfo) => PromiseOrValue<UserModel>;
            };
        }
        "
      `);
    });
    test("Subscription with model", () => {
      const { resolvers, models } = runGenerateTest(graphql`
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
        import type { UserModel } from "./models.interface";
        export declare namespace User {
            export type id = (model: UserModel, args: {}, context: unknown, info: ResolveInfo) => PromiseOrValue<string>;
        }
        export declare namespace Subscription {
            export type userUpdated<A = unknown> = {
                subscribe: (model: unknown, args: {}, context: unknown, info: ResolveInfo) => PromiseOrValue<AsyncIterator<A>>;
                resolve: (parent: A, args: {}, context: unknown, info: ResolveInfo) => PromiseOrValue<UserModel>;
            };
        }
        "
      `);
    });
    test("extends by exteding a type with pre-generated BaseModel type", () => {
      const { resolvers, models } = runGenerateTest(graphql`
        type User {
          id: ID!
        }

        extend type Query {
          users: [User!]!
        }
      `);
      expect(models).toMatchInlineSnapshot(`
        "// Base type for all models. Enables automatic resolution of abstract GraphQL types (interfaces, unions)
        export interface BaseModel {
            readonly __typename?: string;
        }
        export interface UserModel extends BaseModel {
            readonly __typename?: "User";
            readonly id: string;
        }
        "
      `);
      expect(resolvers).toMatchInlineSnapshot(`
        "import type { PromiseOrValue } from "@graphitation/supermassive";
        import type { ResolveInfo } from "@graphitation/supermassive";
        import type { UserModel } from "./models.interface";
        export declare namespace User {
            export type id = (model: UserModel, args: {}, context: unknown, info: ResolveInfo) => PromiseOrValue<string>;
        }
        export declare namespace Query {
            export type users = (model: unknown, args: {}, context: unknown, info: ResolveInfo) => PromiseOrValue<ReadonlyArray<UserModel>>;
        }
        "
      `);
    });
    test("case when interface implements multiple interfaces", () => {
      const { resolvers, models } = runGenerateTest(graphql`
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
      expect(models).toMatchInlineSnapshot(`
        "// Base type for all models. Enables automatic resolution of abstract GraphQL types (interfaces, unions)
        export interface BaseModel {
            readonly __typename?: string;
        }
        export interface NodeModel extends BaseModel {
            readonly __typename?: string;
        }
        export interface PersonaModel extends BaseModel {
            readonly __typename?: string;
        }
        export interface UserModel extends BaseModel, NodeModel, PersonaModel {
            readonly __typename?: string;
        }
        export interface AdminModel extends BaseModel, NodeModel, PersonaModel {
            readonly __typename?: "Admin";
            readonly id: string;
            readonly rank: number;
        }
        "
      `);
      expect(resolvers).toMatchInlineSnapshot(`
        "import type { PromiseOrValue } from "@graphitation/supermassive";
        import type { ResolveInfo } from "@graphitation/supermassive";
        import type { AdminModel, UserModel } from "./models.interface";
        export declare namespace Admin {
            export type id = (model: AdminModel, args: {}, context: unknown, info: ResolveInfo) => PromiseOrValue<string>;
            export type rank = (model: AdminModel, args: {}, context: unknown, info: ResolveInfo) => PromiseOrValue<number>;
        }
        export declare namespace Query {
            export type users = (model: unknown, args: {}, context: unknown, info: ResolveInfo) => PromiseOrValue<ReadonlyArray<UserModel | null> | null>;
            export type admins = (model: unknown, args: {}, context: unknown, info: ResolveInfo) => PromiseOrValue<ReadonlyArray<AdminModel | null> | null>;
        }
        "
      `);
    });
    test("implements", () => {
      const { resolvers, models } = runGenerateTest(graphql`
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
      expect(models).toMatchInlineSnapshot(`
        "// Base type for all models. Enables automatic resolution of abstract GraphQL types (interfaces, unions)
        export interface BaseModel {
            readonly __typename?: string;
        }
        export interface NodeModel extends BaseModel {
            readonly __typename?: string;
        }
        export interface UserModel extends BaseModel, NodeModel {
            readonly __typename?: "User";
            readonly id: string;
            readonly name: string;
        }
        "
      `);
      expect(resolvers).toMatchInlineSnapshot(`
        "import type { PromiseOrValue } from "@graphitation/supermassive";
        import type { ResolveInfo } from "@graphitation/supermassive";
        import type { UserModel } from "./models.interface";
        export declare namespace User {
            export type id = (model: UserModel, args: {}, context: unknown, info: ResolveInfo) => PromiseOrValue<string>;
            export type name = (model: UserModel, args: {}, context: unknown, info: ResolveInfo) => PromiseOrValue<string>;
        }
        export declare namespace Query {
            export type users = (model: unknown, args: {}, context: unknown, info: ResolveInfo) => PromiseOrValue<ReadonlyArray<UserModel | null> | null>;
        }
        "
      `);
    });

    test("if a type is not used it still need to be imported in resolvers", () => {
      const { resolvers, models } = runGenerateTest(graphql`
        interface Node {
          id: ID!
        }

        type User implements Node {
          id: ID!
          name: String!
        }
      `);
      expect(models).toMatchInlineSnapshot(`
        "// Base type for all models. Enables automatic resolution of abstract GraphQL types (interfaces, unions)
        export interface BaseModel {
            readonly __typename?: string;
        }
        export interface NodeModel extends BaseModel {
            readonly __typename?: string;
        }
        export interface UserModel extends BaseModel, NodeModel {
            readonly __typename?: "User";
            readonly id: string;
            readonly name: string;
        }
        "
      `);
      expect(resolvers).toMatchInlineSnapshot(`
        "import type { PromiseOrValue } from "@graphitation/supermassive";
        import type { ResolveInfo } from "@graphitation/supermassive";
        import type { UserModel } from "./models.interface";
        export declare namespace User {
            export type id = (model: UserModel, args: {}, context: unknown, info: ResolveInfo) => PromiseOrValue<string>;
            export type name = (model: UserModel, args: {}, context: unknown, info: ResolveInfo) => PromiseOrValue<string>;
        }
        "
      `);
    });

    test("Input", () => {
      const { resolvers, models } = runGenerateTest(graphql`
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
      expect(models).toMatchInlineSnapshot(`
        "// Base type for all models. Enables automatic resolution of abstract GraphQL types (interfaces, unions)
        export interface BaseModel {
            readonly __typename?: string;
        }
        export interface UserModel extends BaseModel {
            readonly __typename?: "User";
            readonly id: string;
        }
        "
      `);
      expect(resolvers).toMatchInlineSnapshot(`
        "import type { PromiseOrValue } from "@graphitation/supermassive";
        import type { ResolveInfo } from "@graphitation/supermassive";
        import type { UserModel } from "./models.interface";
        export declare namespace User {
            export type id = (model: UserModel, args: {}, context: unknown, info: ResolveInfo) => PromiseOrValue<string>;
        }
        export type UserParamsInput = {
            readonly name: string | null;
        };
        export declare namespace Query {
            export type userById = (model: unknown, args: {
                readonly params: UserParamsInput | null;
            }, context: unknown, info: ResolveInfo) => PromiseOrValue<UserModel | null>;
        }
        "
      `);
    });

    test("Input containing Enum", () => {
      const { resolvers, models } = runGenerateTest(graphql`
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
      expect(models).toMatchInlineSnapshot(`
        "// Base type for all models. Enables automatic resolution of abstract GraphQL types (interfaces, unions)
        export interface BaseModel {
            readonly __typename?: string;
        }
        export interface UserModel extends BaseModel {
            readonly __typename?: "User";
            readonly id: string;
        }
        export const enum RankModel {
            User = "User",
            Admin = "Admin"
        }
        "
      `);
      expect(resolvers).toMatchInlineSnapshot(`
        "import type { PromiseOrValue } from "@graphitation/supermassive";
        import type { ResolveInfo } from "@graphitation/supermassive";
        import type { RankModel, UserModel } from "./models.interface";
        export declare namespace User {
            export type id = (model: UserModel, args: {}, context: unknown, info: ResolveInfo) => PromiseOrValue<string>;
        }
        export type UserParamsInput = {
            readonly name: string | null;
            readonly rank: RankModel | null;
        };
        export declare namespace Query {
            export type userById = (model: unknown, args: {
                readonly params: UserParamsInput | null;
            }, context: unknown, info: ResolveInfo) => PromiseOrValue<UserModel | null>;
        }
        "
      `);
    });

    test("Two nested Inputs", () => {
      const { resolvers, models } = runGenerateTest(graphql`
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
      expect(models).toMatchInlineSnapshot(`
        "// Base type for all models. Enables automatic resolution of abstract GraphQL types (interfaces, unions)
        export interface BaseModel {
            readonly __typename?: string;
        }
        export interface UserModel extends BaseModel {
            readonly __typename?: "User";
            readonly id: string;
        }
        "
      `);
      expect(resolvers).toMatchInlineSnapshot(`
        "import type { PromiseOrValue } from "@graphitation/supermassive";
        import type { ResolveInfo } from "@graphitation/supermassive";
        import type { UserModel } from "./models.interface";
        export declare namespace User {
            export type id = (model: UserModel, args: {}, context: unknown, info: ResolveInfo) => PromiseOrValue<string>;
        }
        export type PresenceInput = {
            readonly type: string;
        };
        export type UserParamsInput = {
            readonly name: string;
            readonly presence: PresenceInput | null;
        };
        export declare namespace Query {
            export type userById = (model: unknown, args: {
                readonly params: UserParamsInput | null;
            }, context: unknown, info: ResolveInfo) => PromiseOrValue<UserModel | null>;
        }
        "
      `);
    });

    test("Enum", () => {
      const { resolvers, models } = runGenerateTest(graphql`
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
      expect(models).toMatchInlineSnapshot(`
        "// Base type for all models. Enables automatic resolution of abstract GraphQL types (interfaces, unions)
        export interface BaseModel {
            readonly __typename?: string;
        }
        export const enum PresenceAvailabilityModel {
            Available = "Available",
            Away = "Away",
            Offline = "Offline"
        }
        export interface UserModel extends BaseModel {
            readonly __typename?: "User";
            readonly id: string;
            readonly availability: PresenceAvailabilityModel;
        }
        "
      `);
      expect(resolvers).toMatchInlineSnapshot(`
        "import type { PromiseOrValue } from "@graphitation/supermassive";
        import type { ResolveInfo } from "@graphitation/supermassive";
        import type { PresenceAvailabilityModel, UserModel } from "./models.interface";
        export declare namespace User {
            export type id = (model: UserModel, args: {}, context: unknown, info: ResolveInfo) => PromiseOrValue<string>;
            export type availability = (model: UserModel, args: {}, context: unknown, info: ResolveInfo) => PromiseOrValue<PresenceAvailabilityModel>;
        }
        export declare namespace Query {
            export type userById = (model: unknown, args: {
                readonly id: string;
            }, context: unknown, info: ResolveInfo) => PromiseOrValue<UserModel | null>;
        }
        "
      `);
    });

    test("Union", () => {
      const { resolvers, models } = runGenerateTest(graphql`
        type Customer {
          id: ID!
        }

        type Admin {
          id: ID!
        }

        union User = Customer | Admin

        extend type Query {
          userById(id: ID!): User
        }
      `);
      expect(models).toMatchInlineSnapshot(`
        "// Base type for all models. Enables automatic resolution of abstract GraphQL types (interfaces, unions)
        export interface BaseModel {
            readonly __typename?: string;
        }
        export interface CustomerModel extends BaseModel {
            readonly __typename?: "Customer";
            readonly id: string;
        }
        export interface AdminModel extends BaseModel {
            readonly __typename?: "Admin";
            readonly id: string;
        }
        export type UserModel = CustomerModel | AdminModel;
        "
      `);
      expect(resolvers).toMatchInlineSnapshot(`
        "import type { PromiseOrValue } from "@graphitation/supermassive";
        import type { ResolveInfo } from "@graphitation/supermassive";
        import type { AdminModel, CustomerModel, UserModel } from "./models.interface";
        export declare namespace Customer {
            export type id = (model: CustomerModel, args: {}, context: unknown, info: ResolveInfo) => PromiseOrValue<string>;
        }
        export declare namespace Admin {
            export type id = (model: AdminModel, args: {}, context: unknown, info: ResolveInfo) => PromiseOrValue<string>;
        }
        export declare namespace Query {
            export type userById = (model: unknown, args: {
                readonly id: string;
            }, context: unknown, info: ResolveInfo) => PromiseOrValue<UserModel | null>;
        }
        "
      `);
    });
  });
  describe("Models", () => {
    it('should import the model and use it in User type"', () => {
      const { resolvers, models } = runGenerateTest(graphql`
        type User @model(from: "./user-model.interface", tsType: "UserModel") {
          id: ID!
        }

        extend type Query {
          userById(id: ID!): User
        }
      `);
      expect(models).toMatchInlineSnapshot(`
        "import type { UserModel as _UserModel } from "../user-model.interface";
        // Base type for all models. Enables automatic resolution of abstract GraphQL types (interfaces, unions)
        export interface BaseModel {
            readonly __typename?: string;
        }
        export interface UserModel extends BaseModel, _UserModel {
            readonly __typename?: "User";
        }
        "
      `);
      expect(resolvers).toMatchInlineSnapshot(`
        "import type { PromiseOrValue } from "@graphitation/supermassive";
        import type { ResolveInfo } from "@graphitation/supermassive";
        import type { UserModel } from "./models.interface";
        export declare namespace User {
            export type id = (model: UserModel, args: {}, context: unknown, info: ResolveInfo) => PromiseOrValue<string>;
        }
        export declare namespace Query {
            export type userById = (model: unknown, args: {
                readonly id: string;
            }, context: unknown, info: ResolveInfo) => PromiseOrValue<UserModel | null>;
        }
        "
      `);
    });
  });

  describe("Import", () => {
    it("shouldn't include Query, Mutation and Subscription in the models", () => {
      const { resolvers, models } = runGenerateTest(graphql`
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
      expect(models).toMatchInlineSnapshot(`
        "// Base type for all models. Enables automatic resolution of abstract GraphQL types (interfaces, unions)
        export interface BaseModel {
            readonly __typename?: string;
        }
        export interface TodoModel extends BaseModel {
            readonly __typename?: "Todo";
            readonly id: string;
            readonly name: string;
        }
        "
      `);
      expect(resolvers).toMatchInlineSnapshot(`
        "import type { PromiseOrValue } from "@graphitation/supermassive";
        import type { ResolveInfo } from "@graphitation/supermassive";
        import type { TodoModel } from "./models.interface";
        export declare namespace Query {
            export type allTodos = (model: unknown, args: {}, context: unknown, info: ResolveInfo) => PromiseOrValue<ReadonlyArray<TodoModel>>;
        }
        export declare namespace Mutation {
            export type createTodo = (model: unknown, args: {}, context: unknown, info: ResolveInfo) => PromiseOrValue<TodoModel>;
        }
        export declare namespace Subscription {
            export type emitTodos<A = unknown> = {
                subscribe: (model: unknown, args: {}, context: unknown, info: ResolveInfo) => PromiseOrValue<AsyncIterator<A>>;
                resolve: (parent: A, args: {}, context: unknown, info: ResolveInfo) => PromiseOrValue<TodoModel | null>;
            };
        }
        export declare namespace Todo {
            export type id = (model: TodoModel, args: {}, context: unknown, info: ResolveInfo) => PromiseOrValue<string>;
            export type name = (model: TodoModel, args: {}, context: unknown, info: ResolveInfo) => PromiseOrValue<string>;
        }
        "
      `);
    });

    it("should import Avatar type and use it in User type", () => {
      const { resolvers, models } = runGenerateTest(graphql`
        extend schema @import(from: "@msteams/packages-test", defs: ["Avatar"])
        type User {
          id: ID!
          avatar: Avatar!
        }

        extend type Query {
          userById(id: ID!): User
        }
      `);
      expect(models).toMatchInlineSnapshot(`
        "import type { AvatarModel } from "@msteams/packages-test";
        // Base type for all models. Enables automatic resolution of abstract GraphQL types (interfaces, unions)
        export interface BaseModel {
            readonly __typename?: string;
        }
        export interface UserModel extends BaseModel {
            readonly __typename?: "User";
            readonly id: string;
            readonly avatar: AvatarModel;
        }
        "
      `);
      expect(resolvers).toMatchInlineSnapshot(`
        "import type { PromiseOrValue } from "@graphitation/supermassive";
        import type { ResolveInfo } from "@graphitation/supermassive";
        import type { UserModel } from "./models.interface";
        import type { AvatarModel } from "@msteams/packages-test";
        export declare namespace User {
            export type id = (model: UserModel, args: {}, context: unknown, info: ResolveInfo) => PromiseOrValue<string>;
            export type avatar = (model: UserModel, args: {}, context: unknown, info: ResolveInfo) => PromiseOrValue<AvatarModel>;
        }
        export declare namespace Query {
            export type userById = (model: unknown, args: {
                readonly id: string;
            }, context: unknown, info: ResolveInfo) => PromiseOrValue<UserModel | null>;
        }
        "
      `);
    });
  });

  it("imports an entity, which is used to implement interface and returned by resolver", () => {
    const { resolvers, models } = runGenerateTest(graphql`
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
    expect(models).toMatchInlineSnapshot(`
      "import type { EntityModel } from "@msteams/packages-test";
      // Base type for all models. Enables automatic resolution of abstract GraphQL types (interfaces, unions)
      export interface BaseModel {
          readonly __typename?: string;
      }
      export interface PersonModel extends BaseModel, EntityModel {
          readonly __typename?: string;
      }
      export interface UserModel extends BaseModel, PersonModel {
          readonly __typename?: "User";
          readonly id: string;
      }
      "
    `);
    expect(resolvers).toMatchInlineSnapshot(`
      "import type { PromiseOrValue } from "@graphitation/supermassive";
      import type { ResolveInfo } from "@graphitation/supermassive";
      import type { PersonModel, UserModel } from "./models.interface";
      export declare namespace User {
          export type id = (model: UserModel, args: {}, context: unknown, info: ResolveInfo) => PromiseOrValue<string>;
      }
      export declare namespace Query {
          export type userById = (model: unknown, args: {
              readonly id: string;
          }, context: unknown, info: ResolveInfo) => PromiseOrValue<PersonModel | null>;
      }
      "
    `);
  });

  it("imports an entity, which is used in a type", () => {
    const { resolvers, models } = runGenerateTest(graphql`
      extend schema @import(from: "@msteams/packages-node", defs: ["Node"])
                    @import(from: "@msteams/packages-rank", defs: ["Rank"])

      type User {
        id: ID!
        rank: Rank!
      }

      extend type Query {
        userById(id: ID!): User
      }
    `);
    expect(models).toMatchInlineSnapshot(`
      "import type { RankModel } from "@msteams/packages-rank";
      // Base type for all models. Enables automatic resolution of abstract GraphQL types (interfaces, unions)
      export interface BaseModel {
          readonly __typename?: string;
      }
      export interface UserModel extends BaseModel {
          readonly __typename?: "User";
          readonly id: string;
          readonly rank: RankModel;
      }
      "
    `);
    expect(resolvers).toMatchInlineSnapshot(`
      "import type { PromiseOrValue } from "@graphitation/supermassive";
      import type { ResolveInfo } from "@graphitation/supermassive";
      import type { UserModel } from "./models.interface";
      import type { RankModel } from "@msteams/packages-rank";
      export declare namespace User {
          export type id = (model: UserModel, args: {}, context: unknown, info: ResolveInfo) => PromiseOrValue<string>;
          export type rank = (model: UserModel, args: {}, context: unknown, info: ResolveInfo) => PromiseOrValue<RankModel>;
      }
      export declare namespace Query {
          export type userById = (model: unknown, args: {
              readonly id: string;
          }, context: unknown, info: ResolveInfo) => PromiseOrValue<UserModel | null>;
      }
      "
    `);
  });

  it("works when an operation has scalar, input and Enum as parameters", () => {
    const { resolvers, models } = runGenerateTest(graphql`
      extend schema @import(from: "@msteams/packages-node", defs: ["Node"])
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
        isUser(userParam: UserParam!, userType: UserType!, dateTime: DateTime!): Boolean
      }
    `);
    expect(models).toMatchInlineSnapshot(`
      "// Base type for all models. Enables automatic resolution of abstract GraphQL types (interfaces, unions)
      export interface BaseModel {
          readonly __typename?: string;
      }
      export type DateTimeModel = unknown;
      export const enum UserTypeModel {
          Admin = "Admin",
          User = "User"
      }
      "
    `);
    expect(resolvers).toMatchInlineSnapshot(`
      "import type { PromiseOrValue } from "@graphitation/supermassive";
      import type { ResolveInfo } from "@graphitation/supermassive";
      import type { DateTimeModel, UserTypeModel } from "./models.interface";
      import type { RankModel } from "@msteams/packages-rank";
      export type UserParam = {
          readonly id: string;
          readonly rank: RankModel;
      };
      export declare namespace Query {
          export type isUser = (model: unknown, args: {
              readonly userParam: UserParam;
              readonly userType: UserTypeModel;
              readonly dateTime: DateTimeModel;
          }, context: unknown, info: ResolveInfo) => PromiseOrValue<boolean | null>;
      }
      "
    `);
  });

  it("imports an entity, which is used in an input", () => {
    const { resolvers, models } = runGenerateTest(graphql`
      extend schema @import(from: "@msteams/packages-node", defs: ["Node"])
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
    expect(models).toMatchInlineSnapshot(`
      "import type { RankModel } from "@msteams/packages-rank";
      // Base type for all models. Enables automatic resolution of abstract GraphQL types (interfaces, unions)
      export interface BaseModel {
          readonly __typename?: string;
      }
      export interface UserModel extends BaseModel {
          readonly __typename?: "User";
          readonly id: string;
          readonly rank: RankModel;
      }
      "
    `);
    expect(resolvers).toMatchInlineSnapshot(`
      "import type { PromiseOrValue } from "@graphitation/supermassive";
      import type { ResolveInfo } from "@graphitation/supermassive";
      import type { UserModel } from "./models.interface";
      import type { RankModel } from "@msteams/packages-rank";
      export declare namespace User {
          export type id = (model: UserModel, args: {}, context: unknown, info: ResolveInfo) => PromiseOrValue<string>;
          export type rank = (model: UserModel, args: {}, context: unknown, info: ResolveInfo) => PromiseOrValue<RankModel>;
      }
      export type UserInput = {
          readonly id: string;
          readonly rank: RankModel;
      };
      export declare namespace Query {
          export type userById = (model: unknown, args: {
              readonly params: UserInput | null;
          }, context: unknown, info: ResolveInfo) => PromiseOrValue<UserModel | null>;
      }
      "
    `);
  });

  it("imported Rank shouldn't be imported in the model, because it's used in a type, which has the model directive", () => {
    const { resolvers, models } = runGenerateTest(graphql`
      extend schema @import(from: "@msteams/packages-node", defs: ["Node"])
                    @import(from: "@msteams/packages-rank", defs: ["Rank"])

      type User @model(tsType: "User", from: "@msteams/custom-user") {
        id: ID!
        rank: Rank!
      }

      extend type Query {
        userById(id: ID!): User
      }
    `);
    expect(models).toMatchInlineSnapshot(`
      "import type { User as _UserModel } from "@msteams/custom-user";
      // Base type for all models. Enables automatic resolution of abstract GraphQL types (interfaces, unions)
      export interface BaseModel {
          readonly __typename?: string;
      }
      export interface UserModel extends BaseModel, _UserModel {
          readonly __typename?: "User";
      }
      "
    `);
    expect(resolvers).toMatchInlineSnapshot(`
      "import type { PromiseOrValue } from "@graphitation/supermassive";
      import type { ResolveInfo } from "@graphitation/supermassive";
      import type { UserModel } from "./models.interface";
      import type { RankModel } from "@msteams/packages-rank";
      export declare namespace User {
          export type id = (model: UserModel, args: {}, context: unknown, info: ResolveInfo) => PromiseOrValue<string>;
          export type rank = (model: UserModel, args: {}, context: unknown, info: ResolveInfo) => PromiseOrValue<RankModel>;
      }
      export declare namespace Query {
          export type userById = (model: unknown, args: {
              readonly id: string;
          }, context: unknown, info: ResolveInfo) => PromiseOrValue<UserModel | null>;
      }
      "
    `);
  });

  it("imports an entity, which is used in a nested input", () => {
    const { resolvers, models } = runGenerateTest(graphql`
      extend schema @import(from: "@msteams/packages-node", defs: ["Node"])
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
    expect(models).toMatchInlineSnapshot(`
      "import type { RankModel } from "@msteams/packages-rank";
      // Base type for all models. Enables automatic resolution of abstract GraphQL types (interfaces, unions)
      export interface BaseModel {
          readonly __typename?: string;
      }
      export interface UserModel extends BaseModel {
          readonly __typename?: "User";
          readonly id: string;
          readonly rank: RankModel;
      }
      "
    `);
    expect(resolvers).toMatchInlineSnapshot(`
      "import type { PromiseOrValue } from "@graphitation/supermassive";
      import type { ResolveInfo } from "@graphitation/supermassive";
      import type { UserModel } from "./models.interface";
      import type { RankModel } from "@msteams/packages-rank";
      export declare namespace User {
          export type id = (model: UserModel, args: {}, context: unknown, info: ResolveInfo) => PromiseOrValue<string>;
          export type rank = (model: UserModel, args: {}, context: unknown, info: ResolveInfo) => PromiseOrValue<RankModel>;
      }
      export type RankParams = {
          readonly rank: RankModel;
      };
      export type UserParams = {
          readonly id: string;
          readonly rank: RankParams;
      };
      export declare namespace Query {
          export type userById = (model: unknown, args: {
              readonly params: UserParams | null;
          }, context: unknown, info: ResolveInfo) => PromiseOrValue<UserModel | null>;
      }
      "
    `);
  });

  describe("Scalars", () => {
    it('expects custom scalars "DateTime" to be "string"', () => {
      const { resolvers, models } = runGenerateTest(graphql`
        scalar DateTime @model(tsType: "string")

        type User {
          id: ID!
          dateTime: DateTime!
        }

        extend type Query {
          userById(id: ID!): User
        }
      `);
      expect(models).toMatchInlineSnapshot(`
        "// Base type for all models. Enables automatic resolution of abstract GraphQL types (interfaces, unions)
        export interface BaseModel {
            readonly __typename?: string;
        }
        export type DateTimeModel = string;
        export interface UserModel extends BaseModel {
            readonly __typename?: "User";
            readonly id: string;
            readonly dateTime: DateTimeModel;
        }
        "
      `);
      expect(resolvers).toMatchInlineSnapshot(`
        "import type { PromiseOrValue } from "@graphitation/supermassive";
        import type { ResolveInfo } from "@graphitation/supermassive";
        import type { DateTimeModel, UserModel } from "./models.interface";
        export declare namespace User {
            export type id = (model: UserModel, args: {}, context: unknown, info: ResolveInfo) => PromiseOrValue<string>;
            export type dateTime = (model: UserModel, args: {}, context: unknown, info: ResolveInfo) => PromiseOrValue<DateTimeModel>;
        }
        export declare namespace Query {
            export type userById = (model: unknown, args: {
                readonly id: string;
            }, context: unknown, info: ResolveInfo) => PromiseOrValue<UserModel | null>;
        }
        "
      `);
    });
    it('expects custom scalars "DateTime" to be model', () => {
      const { resolvers, models } = runGenerateTest(graphql`
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
      expect(models).toMatchInlineSnapshot(`
        "import type { DateTimeModel as _DateTimeModel } from "@msteams/custom-scalars";
        // Base type for all models. Enables automatic resolution of abstract GraphQL types (interfaces, unions)
        export interface BaseModel {
            readonly __typename?: string;
        }
        export type DateTimeModel = _DateTimeModel;
        export interface UserModel extends BaseModel {
            readonly __typename?: "User";
            readonly id: string;
            readonly dateTime: DateTimeModel;
        }
        "
      `);
      expect(resolvers).toMatchInlineSnapshot(`
        "import type { PromiseOrValue } from "@graphitation/supermassive";
        import type { ResolveInfo } from "@graphitation/supermassive";
        import type { DateTimeModel, UserModel } from "./models.interface";
        export declare namespace User {
            export type id = (model: UserModel, args: {}, context: unknown, info: ResolveInfo) => PromiseOrValue<string>;
            export type dateTime = (model: UserModel, args: {}, context: unknown, info: ResolveInfo) => PromiseOrValue<DateTimeModel>;
        }
        export declare namespace Query {
            export type userById = (model: unknown, args: {
                readonly id: string;
            }, context: unknown, info: ResolveInfo) => PromiseOrValue<UserModel | null>;
        }
        "
      `);
    });
    it("expects built-in scalars to not be generated in models and typescript types used directly in resolvers", () => {
      const { resolvers, models } = runGenerateTest(graphql`
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
      expect(models).toMatchInlineSnapshot(`
        "// Base type for all models. Enables automatic resolution of abstract GraphQL types (interfaces, unions)
        export interface BaseModel {
            readonly __typename?: string;
        }
        export interface UserModel extends BaseModel {
            readonly __typename?: "User";
            readonly id: string;
            readonly name: string;
            readonly age: number | null;
            readonly rating: number | null;
            readonly isAdmin: boolean;
        }
        "
      `);
      expect(resolvers).toMatchInlineSnapshot(`
        "import type { PromiseOrValue } from "@graphitation/supermassive";
        import type { ResolveInfo } from "@graphitation/supermassive";
        import type { UserModel } from "./models.interface";
        export declare namespace User {
            export type id = (model: UserModel, args: {}, context: unknown, info: ResolveInfo) => PromiseOrValue<string>;
            export type name = (model: UserModel, args: {}, context: unknown, info: ResolveInfo) => PromiseOrValue<string>;
            export type age = (model: UserModel, args: {}, context: unknown, info: ResolveInfo) => PromiseOrValue<number | null>;
            export type rating = (model: UserModel, args: {}, context: unknown, info: ResolveInfo) => PromiseOrValue<number | null>;
            export type isAdmin = (model: UserModel, args: {}, context: unknown, info: ResolveInfo) => PromiseOrValue<boolean>;
        }
        export declare namespace Query {
            export type node = (model: unknown, args: {
                readonly id: string;
                readonly name: string;
                readonly age: number | null;
                readonly rating: number | null;
                readonly isAdmin: boolean | null;
            }, context: unknown, info: ResolveInfo) => PromiseOrValue<UserModel>;
        }
        "
      `);
    });
  });

  it("generateTS without ContextName and ContextImport", () => {
    const { models, resolvers } = runGenerateTest(graphql`
      interface Node {
        id: ID!
      }

      extend type Query {
        node(id: ID!): Node!
      }
    `);
    expect(models).toMatchInlineSnapshot(`
      "// Base type for all models. Enables automatic resolution of abstract GraphQL types (interfaces, unions)
      export interface BaseModel {
          readonly __typename?: string;
      }
      export interface NodeModel extends BaseModel {
          readonly __typename?: string;
      }
      "
    `);
    expect(resolvers).toMatchInlineSnapshot(`
      "import type { PromiseOrValue } from "@graphitation/supermassive";
      import type { ResolveInfo } from "@graphitation/supermassive";
      import type { NodeModel } from "./models.interface";
      export declare namespace Query {
          export type node = (model: unknown, args: {
              readonly id: string;
          }, context: unknown, info: ResolveInfo) => PromiseOrValue<NodeModel>;
      }
      "
    `);
  });
});

function runGenerateTest(
  doc: string,
  outputDir = "__generated__",
  inputPath = "./typedef.graphql",
  contextImport?: string,
  contextName?: string,
): { models: string; resolvers: string } {
  const document = parse(doc);
  const result = generateTS(
    document,
    path.resolve(process.cwd(), outputDir),
    path.resolve(process.cwd(), inputPath),
    contextImport || null,
    contextName,
  );
  const printer = ts.createPrinter();
  return {
    models: printer.printFile(result.models),
    resolvers: printer.printFile(result.resolvers),
  };
}
