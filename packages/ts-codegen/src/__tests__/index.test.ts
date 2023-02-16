import ts from "typescript";
import { parse } from "graphql";
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
        "import type { PromiseOrValue } from "@graphitation/supermassive";
        import type { ResolveInfo } from "@graphitation/supermassive";
        import type { Message, Post, User } from "./models.interface";
        import type { Avatar } from "@msteams/packages-test";
        export declare namespace Post {
            export interface Resolvers {
                readonly id?: id;
            }
            export type id = (model: Post, args: {}, context: unknown, info: ResolveInfo) => PromiseOrValue<string>;
        }
        export declare namespace Message {
            export interface Resolvers {
                readonly id?: id;
            }
            export type id = (model: Message, args: {}, context: unknown, info: ResolveInfo) => PromiseOrValue<string>;
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
            export type id = (model: User, args: {}, context: unknown, info: ResolveInfo) => PromiseOrValue<string>;
            export type name = (model: User, args: {}, context: unknown, info: ResolveInfo) => PromiseOrValue<string | null | undefined>;
            export type messagesWithAnswersNonRequired = (model: User, args: {}, context: unknown, info: ResolveInfo) => PromiseOrValue<ReadonlyArray<ReadonlyArray<Message | null | undefined> | null | undefined> | null | undefined>;
            export type messagesWithAnswersRequired = (model: User, args: {}, context: unknown, info: ResolveInfo) => PromiseOrValue<ReadonlyArray<ReadonlyArray<Message | null | undefined> | null | undefined>>;
            export type messagesWithAnswersAllRequired = (model: User, args: {}, context: unknown, info: ResolveInfo) => PromiseOrValue<ReadonlyArray<ReadonlyArray<Message>>>;
            export type messagesNonRequired = (model: User, args: {}, context: unknown, info: ResolveInfo) => PromiseOrValue<ReadonlyArray<Message | null | undefined> | null | undefined>;
            export type messagesWithArrayRequired = (model: User, args: {}, context: unknown, info: ResolveInfo) => PromiseOrValue<ReadonlyArray<Message | null | undefined>>;
            export type messagesRequired = (model: User, args: {}, context: unknown, info: ResolveInfo) => PromiseOrValue<ReadonlyArray<Message>>;
            export type messagesOnlyMessageRequired = (model: User, args: {}, context: unknown, info: ResolveInfo) => PromiseOrValue<ReadonlyArray<Message> | null | undefined>;
            export type post = (model: User, args: {}, context: unknown, info: ResolveInfo) => PromiseOrValue<Post | null | undefined>;
            export type postRequired = (model: User, args: {}, context: unknown, info: ResolveInfo) => PromiseOrValue<Post>;
            export type avatar = (model: User, args: {}, context: unknown, info: ResolveInfo) => PromiseOrValue<Avatar | null | undefined>;
            export type avatarRequired = (model: User, args: {}, context: unknown, info: ResolveInfo) => PromiseOrValue<Avatar>;
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
            export type requiredUsers = (model: unknown, args: {}, context: unknown, info: ResolveInfo) => PromiseOrValue<ReadonlyArray<User>>;
            export type optionalUsers = (model: unknown, args: {}, context: unknown, info: ResolveInfo) => PromiseOrValue<ReadonlyArray<User | null | undefined> | null | undefined>;
            export type optionalUser = (model: unknown, args: {}, context: unknown, info: ResolveInfo) => PromiseOrValue<User | null | undefined>;
            export type requiredUser = (model: unknown, args: {}, context: unknown, info: ResolveInfo) => PromiseOrValue<User>;
            export type requiredPost = (model: unknown, args: {}, context: unknown, info: ResolveInfo) => PromiseOrValue<Post>;
            export type optionalPost = (model: unknown, args: {}, context: unknown, info: ResolveInfo) => PromiseOrValue<Post | null | undefined>;
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
        export interface User extends BaseModel {
            readonly __typename?: "User";
            readonly id: string;
        }
        "
      `);
      expect(resolvers).toMatchInlineSnapshot(`
        "import type { PromiseOrValue } from "@graphitation/supermassive";
        import type { ResolveInfo } from "@graphitation/supermassive";
        import type { User } from "./models.interface";
        export declare namespace User {
            export interface Resolvers {
                readonly id?: id;
            }
            export type id = (model: User, args: {}, context: unknown, info: ResolveInfo) => PromiseOrValue<string>;
        }
        export declare namespace Subscription {
            export interface Resolvers {
                readonly userUpdated?: userUpdated<any>;
            }
            export type userUpdated<SubscribeResult = never> = {
                subscribe: (model: unknown, args: {}, context: unknown, info: ResolveInfo) => PromiseOrValue<AsyncIterator<{
                    userUpdated: User;
                }>>;
            } | {
                subscribe: (model: unknown, args: {}, context: unknown, info: ResolveInfo) => PromiseOrValue<AsyncIterator<SubscribeResult>>;
                resolve: (subcribeResult: SubscribeResult, args: {}, context: unknown, info: ResolveInfo) => PromiseOrValue<User>;
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
        import type { User } from "./models.interface";
        export declare namespace User {
            export interface Resolvers {
                readonly id?: id;
            }
            export type id = (model: User, args: {}, context: unknown, info: ResolveInfo) => PromiseOrValue<string>;
        }
        export declare namespace Subscription {
            export interface Resolvers {
                readonly userUpdated?: userUpdated<any>;
            }
            export type userUpdated<SubscribeResult = never> = {
                subscribe: (model: unknown, args: {}, context: unknown, info: ResolveInfo) => PromiseOrValue<AsyncIterator<{
                    userUpdated: User;
                }>>;
            } | {
                subscribe: (model: unknown, args: {}, context: unknown, info: ResolveInfo) => PromiseOrValue<AsyncIterator<SubscribeResult>>;
                resolve: (subcribeResult: SubscribeResult, args: {}, context: unknown, info: ResolveInfo) => PromiseOrValue<User>;
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
        export interface User extends BaseModel {
            readonly __typename?: "User";
            readonly id: string;
        }
        "
      `);
      expect(resolvers).toMatchInlineSnapshot(`
        "import type { PromiseOrValue } from "@graphitation/supermassive";
        import type { ResolveInfo } from "@graphitation/supermassive";
        import type { User } from "./models.interface";
        export declare namespace User {
            export interface Resolvers {
                readonly id?: id;
            }
            export type id = (model: User, args: {}, context: unknown, info: ResolveInfo) => PromiseOrValue<string>;
        }
        export declare namespace Query {
            export interface Resolvers {
                readonly users?: users;
            }
            export type users = (model: unknown, args: {}, context: unknown, info: ResolveInfo) => PromiseOrValue<ReadonlyArray<User>>;
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
        import type { Admin, User } from "./models.interface";
        export declare namespace Admin {
            export interface Resolvers {
                readonly id?: id;
                readonly rank?: rank;
            }
            export type id = (model: Admin, args: {}, context: unknown, info: ResolveInfo) => PromiseOrValue<string>;
            export type rank = (model: Admin, args: {}, context: unknown, info: ResolveInfo) => PromiseOrValue<number>;
        }
        export declare namespace Query {
            export interface Resolvers {
                readonly users?: users;
                readonly admins?: admins;
            }
            export type users = (model: unknown, args: {}, context: unknown, info: ResolveInfo) => PromiseOrValue<ReadonlyArray<User | null | undefined> | null | undefined>;
            export type admins = (model: unknown, args: {}, context: unknown, info: ResolveInfo) => PromiseOrValue<ReadonlyArray<Admin | null | undefined> | null | undefined>;
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
        import type { User } from "./models.interface";
        export declare namespace User {
            export interface Resolvers {
                readonly id?: id;
                readonly name?: name;
            }
            export type id = (model: User, args: {}, context: unknown, info: ResolveInfo) => PromiseOrValue<string>;
            export type name = (model: User, args: {}, context: unknown, info: ResolveInfo) => PromiseOrValue<string>;
        }
        export declare namespace Query {
            export interface Resolvers {
                readonly users?: users;
            }
            export type users = (model: unknown, args: {}, context: unknown, info: ResolveInfo) => PromiseOrValue<ReadonlyArray<User | null | undefined> | null | undefined>;
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
        import type { User } from "./models.interface";
        export declare namespace User {
            export interface Resolvers {
                readonly id?: id;
                readonly name?: name;
            }
            export type id = (model: User, args: {}, context: unknown, info: ResolveInfo) => PromiseOrValue<string>;
            export type name = (model: User, args: {}, context: unknown, info: ResolveInfo) => PromiseOrValue<string>;
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
        export interface User extends BaseModel {
            readonly __typename?: "User";
            readonly id: string;
        }
        "
      `);
      expect(resolvers).toMatchInlineSnapshot(`
        "import type { PromiseOrValue } from "@graphitation/supermassive";
        import type { ResolveInfo } from "@graphitation/supermassive";
        import type { User } from "./models.interface";
        export declare namespace User {
            export interface Resolvers {
                readonly id?: id;
            }
            export type id = (model: User, args: {}, context: unknown, info: ResolveInfo) => PromiseOrValue<string>;
        }
        export type UserParamsInput = {
            readonly name?: string | null;
        };
        export declare namespace Query {
            export interface Resolvers {
                readonly userById?: userById;
            }
            export type userById = (model: unknown, args: {
                readonly params?: UserParamsInput | null;
            }, context: unknown, info: ResolveInfo) => PromiseOrValue<User | null | undefined>;
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
        export { Rank } from "./enums.interface";
        export interface User extends BaseModel {
            readonly __typename?: "User";
            readonly id: string;
        }
        "
      `);
      expect(resolvers).toMatchInlineSnapshot(`
        "import type { PromiseOrValue } from "@graphitation/supermassive";
        import type { ResolveInfo } from "@graphitation/supermassive";
        import type { Rank, User } from "./models.interface";
        export declare namespace User {
            export interface Resolvers {
                readonly id?: id;
            }
            export type id = (model: User, args: {}, context: unknown, info: ResolveInfo) => PromiseOrValue<string>;
        }
        export type UserParamsInput = {
            readonly name?: string | null;
            readonly rank?: Rank | null;
        };
        export declare namespace Query {
            export interface Resolvers {
                readonly userById?: userById;
            }
            export type userById = (model: unknown, args: {
                readonly params?: UserParamsInput | null;
            }, context: unknown, info: ResolveInfo) => PromiseOrValue<User | null | undefined>;
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
        export interface User extends BaseModel {
            readonly __typename?: "User";
            readonly id: string;
        }
        "
      `);
      expect(resolvers).toMatchInlineSnapshot(`
        "import type { PromiseOrValue } from "@graphitation/supermassive";
        import type { ResolveInfo } from "@graphitation/supermassive";
        import type { User } from "./models.interface";
        export declare namespace User {
            export interface Resolvers {
                readonly id?: id;
            }
            export type id = (model: User, args: {}, context: unknown, info: ResolveInfo) => PromiseOrValue<string>;
        }
        export type PresenceInput = {
            readonly type: string;
        };
        export type UserParamsInput = {
            readonly name: string;
            readonly presence?: PresenceInput | null;
        };
        export declare namespace Query {
            export interface Resolvers {
                readonly userById?: userById;
            }
            export type userById = (model: unknown, args: {
                readonly params?: UserParamsInput | null;
            }, context: unknown, info: ResolveInfo) => PromiseOrValue<User | null | undefined>;
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
        import { PresenceAvailability } from "./enums.interface";
        export { PresenceAvailability } from "./enums.interface";
        export interface User extends BaseModel {
            readonly __typename?: "User";
            readonly id: string;
            readonly availability: PresenceAvailability;
        }
        "
      `);
      expect(resolvers).toMatchInlineSnapshot(`
        "import type { PromiseOrValue } from "@graphitation/supermassive";
        import type { ResolveInfo } from "@graphitation/supermassive";
        import type { PresenceAvailability, User } from "./models.interface";
        export declare namespace User {
            export interface Resolvers {
                readonly id?: id;
                readonly availability?: availability;
            }
            export type id = (model: User, args: {}, context: unknown, info: ResolveInfo) => PromiseOrValue<string>;
            export type availability = (model: User, args: {}, context: unknown, info: ResolveInfo) => PromiseOrValue<PresenceAvailability>;
        }
        export declare namespace Query {
            export interface Resolvers {
                readonly userById?: userById;
            }
            export type userById = (model: unknown, args: {
                readonly id: string;
            }, context: unknown, info: ResolveInfo) => PromiseOrValue<User | null | undefined>;
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
        export interface Customer extends BaseModel {
            readonly __typename?: "Customer";
            readonly id: string;
        }
        export interface Admin extends BaseModel {
            readonly __typename?: "Admin";
            readonly id: string;
        }
        export type User = Customer | Admin;
        "
      `);
      expect(resolvers).toMatchInlineSnapshot(`
        "import type { PromiseOrValue } from "@graphitation/supermassive";
        import type { ResolveInfo } from "@graphitation/supermassive";
        import type { Admin, Customer, User } from "./models.interface";
        export declare namespace Customer {
            export interface Resolvers {
                readonly id?: id;
            }
            export type id = (model: Customer, args: {}, context: unknown, info: ResolveInfo) => PromiseOrValue<string>;
        }
        export declare namespace Admin {
            export interface Resolvers {
                readonly id?: id;
            }
            export type id = (model: Admin, args: {}, context: unknown, info: ResolveInfo) => PromiseOrValue<string>;
        }
        export declare namespace User {
            export interface Resolvers {
                readonly __resolveType?: __resolveType;
            }
            export type __resolveType = (parent: Customer | Admin, context: unknown, info: ResolveInfo) => PromiseOrValue<"Customer" | "Admin" | null>;
        }
        export declare namespace Query {
            export interface Resolvers {
                readonly userById?: userById;
            }
            export type userById = (model: unknown, args: {
                readonly id: string;
            }, context: unknown, info: ResolveInfo) => PromiseOrValue<User | null | undefined>;
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
        import type { User } from "./models.interface";
        export declare namespace User {
            export interface Resolvers {
                readonly id?: id;
            }
            export type id = (model: User, args: {}, context: unknown, info: ResolveInfo) => PromiseOrValue<string>;
        }
        export declare namespace Query {
            export interface Resolvers {
                readonly userById?: userById;
            }
            export type userById = (model: unknown, args: {
                readonly id: string;
            }, context: unknown, info: ResolveInfo) => PromiseOrValue<User | null | undefined>;
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
        import type { Todo } from "./models.interface";
        export declare namespace Query {
            export interface Resolvers {
                readonly allTodos?: allTodos;
            }
            export type allTodos = (model: unknown, args: {}, context: unknown, info: ResolveInfo) => PromiseOrValue<ReadonlyArray<Todo>>;
        }
        export declare namespace Mutation {
            export interface Resolvers {
                readonly createTodo?: createTodo;
            }
            export type createTodo = (model: unknown, args: {}, context: unknown, info: ResolveInfo) => PromiseOrValue<Todo>;
        }
        export declare namespace Subscription {
            export interface Resolvers {
                readonly emitTodos?: emitTodos<any>;
            }
            export type emitTodos<SubscribeResult = never> = {
                subscribe: (model: unknown, args: {}, context: unknown, info: ResolveInfo) => PromiseOrValue<AsyncIterator<{
                    emitTodos: Todo | null | undefined;
                }>>;
            } | {
                subscribe: (model: unknown, args: {}, context: unknown, info: ResolveInfo) => PromiseOrValue<AsyncIterator<SubscribeResult>>;
                resolve: (subcribeResult: SubscribeResult, args: {}, context: unknown, info: ResolveInfo) => PromiseOrValue<Todo | null | undefined>;
            };
        }
        export declare namespace Todo {
            export interface Resolvers {
                readonly id?: id;
                readonly name?: name;
            }
            export type id = (model: Todo, args: {}, context: unknown, info: ResolveInfo) => PromiseOrValue<string>;
            export type name = (model: Todo, args: {}, context: unknown, info: ResolveInfo) => PromiseOrValue<string>;
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
        "import type { PromiseOrValue } from "@graphitation/supermassive";
        import type { ResolveInfo } from "@graphitation/supermassive";
        import type { User } from "./models.interface";
        import type { Avatar } from "@msteams/packages-test";
        export declare namespace User {
            export interface Resolvers {
                readonly id?: id;
                readonly avatar?: avatar;
            }
            export type id = (model: User, args: {}, context: unknown, info: ResolveInfo) => PromiseOrValue<string>;
            export type avatar = (model: User, args: {}, context: unknown, info: ResolveInfo) => PromiseOrValue<Avatar>;
        }
        export declare namespace Query {
            export interface Resolvers {
                readonly userById?: userById;
            }
            export type userById = (model: unknown, args: {
                readonly id: string;
            }, context: unknown, info: ResolveInfo) => PromiseOrValue<User | null | undefined>;
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
      import type { Person, User } from "./models.interface";
      export declare namespace User {
          export interface Resolvers {
              readonly id?: id;
          }
          export type id = (model: User, args: {}, context: unknown, info: ResolveInfo) => PromiseOrValue<string>;
      }
      export declare namespace Query {
          export interface Resolvers {
              readonly userById?: userById;
          }
          export type userById = (model: unknown, args: {
              readonly id: string;
          }, context: unknown, info: ResolveInfo) => PromiseOrValue<Person | null | undefined>;
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
      "import type { PromiseOrValue } from "@graphitation/supermassive";
      import type { ResolveInfo } from "@graphitation/supermassive";
      import type { User } from "./models.interface";
      import type { Rank } from "@msteams/packages-rank";
      export declare namespace User {
          export interface Resolvers {
              readonly id?: id;
              readonly rank?: rank;
          }
          export type id = (model: User, args: {}, context: unknown, info: ResolveInfo) => PromiseOrValue<string>;
          export type rank = (model: User, args: {}, context: unknown, info: ResolveInfo) => PromiseOrValue<Rank>;
      }
      export declare namespace Query {
          export interface Resolvers {
              readonly userById?: userById;
          }
          export type userById = (model: unknown, args: {
              readonly id: string;
          }, context: unknown, info: ResolveInfo) => PromiseOrValue<User | null | undefined>;
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
      export { UserType } from "./enums.interface";
      export type DateTime = unknown;
      "
    `);
    expect(resolvers).toMatchInlineSnapshot(`
      "import type { PromiseOrValue } from "@graphitation/supermassive";
      import type { ResolveInfo } from "@graphitation/supermassive";
      import type { DateTime, UserType } from "./models.interface";
      import type { Rank } from "@msteams/packages-rank";
      export type UserParam = {
          readonly id: string;
          readonly rank: Rank;
      };
      export declare namespace Query {
          export interface Resolvers {
              readonly isUser?: isUser;
          }
          export type isUser = (model: unknown, args: {
              readonly userParam: UserParam;
              readonly userType: UserType;
              readonly dateTime: DateTime;
          }, context: unknown, info: ResolveInfo) => PromiseOrValue<boolean | null | undefined>;
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
      "import type { PromiseOrValue } from "@graphitation/supermassive";
      import type { ResolveInfo } from "@graphitation/supermassive";
      import type { User } from "./models.interface";
      import type { Rank } from "@msteams/packages-rank";
      export declare namespace User {
          export interface Resolvers {
              readonly id?: id;
              readonly rank?: rank;
          }
          export type id = (model: User, args: {}, context: unknown, info: ResolveInfo) => PromiseOrValue<string>;
          export type rank = (model: User, args: {}, context: unknown, info: ResolveInfo) => PromiseOrValue<Rank>;
      }
      export type UserInput = {
          readonly id: string;
          readonly rank: Rank;
      };
      export declare namespace Query {
          export interface Resolvers {
              readonly userById?: userById;
          }
          export type userById = (model: unknown, args: {
              readonly params?: UserInput | null;
          }, context: unknown, info: ResolveInfo) => PromiseOrValue<User | null | undefined>;
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
      "import type { PromiseOrValue } from "@graphitation/supermassive";
      import type { ResolveInfo } from "@graphitation/supermassive";
      import type { User } from "./models.interface";
      import type { Rank } from "@msteams/packages-rank";
      export declare namespace User {
          export interface Resolvers {
              readonly id?: id;
              readonly rank?: rank;
          }
          export type id = (model: User, args: {}, context: unknown, info: ResolveInfo) => PromiseOrValue<string>;
          export type rank = (model: User, args: {}, context: unknown, info: ResolveInfo) => PromiseOrValue<Rank>;
      }
      export declare namespace Query {
          export interface Resolvers {
              readonly userById?: userById;
          }
          export type userById = (model: unknown, args: {
              readonly id: string;
          }, context: unknown, info: ResolveInfo) => PromiseOrValue<User | null | undefined>;
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
      "import type { PromiseOrValue } from "@graphitation/supermassive";
      import type { ResolveInfo } from "@graphitation/supermassive";
      import type { User } from "./models.interface";
      import type { Rank } from "@msteams/packages-rank";
      export declare namespace User {
          export interface Resolvers {
              readonly id?: id;
              readonly rank?: rank;
          }
          export type id = (model: User, args: {}, context: unknown, info: ResolveInfo) => PromiseOrValue<string>;
          export type rank = (model: User, args: {}, context: unknown, info: ResolveInfo) => PromiseOrValue<Rank>;
      }
      export type RankParams = {
          readonly rank: Rank;
      };
      export type UserParams = {
          readonly id: string;
          readonly rank: RankParams;
      };
      export declare namespace Query {
          export interface Resolvers {
              readonly userById?: userById;
          }
          export type userById = (model: unknown, args: {
              readonly params?: UserParams | null;
          }, context: unknown, info: ResolveInfo) => PromiseOrValue<User | null | undefined>;
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
        import type { DateTime, User } from "./models.interface";
        export declare namespace User {
            export interface Resolvers {
                readonly id?: id;
                readonly dateTime?: dateTime;
            }
            export type id = (model: User, args: {}, context: unknown, info: ResolveInfo) => PromiseOrValue<string>;
            export type dateTime = (model: User, args: {}, context: unknown, info: ResolveInfo) => PromiseOrValue<DateTime>;
        }
        export declare namespace Query {
            export interface Resolvers {
                readonly userById?: userById;
            }
            export type userById = (model: unknown, args: {
                readonly id: string;
            }, context: unknown, info: ResolveInfo) => PromiseOrValue<User | null | undefined>;
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
        import type { DateTime, User } from "./models.interface";
        export declare namespace User {
            export interface Resolvers {
                readonly id?: id;
                readonly dateTime?: dateTime;
            }
            export type id = (model: User, args: {}, context: unknown, info: ResolveInfo) => PromiseOrValue<string>;
            export type dateTime = (model: User, args: {}, context: unknown, info: ResolveInfo) => PromiseOrValue<DateTime>;
        }
        export declare namespace Query {
            export interface Resolvers {
                readonly userById?: userById;
            }
            export type userById = (model: unknown, args: {
                readonly id: string;
            }, context: unknown, info: ResolveInfo) => PromiseOrValue<User | null | undefined>;
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
        import type { User } from "./models.interface";
        export declare namespace User {
            export interface Resolvers {
                readonly id?: id;
                readonly name?: name;
                readonly age?: age;
                readonly rating?: rating;
                readonly isAdmin?: isAdmin;
            }
            export type id = (model: User, args: {}, context: unknown, info: ResolveInfo) => PromiseOrValue<string>;
            export type name = (model: User, args: {}, context: unknown, info: ResolveInfo) => PromiseOrValue<string>;
            export type age = (model: User, args: {}, context: unknown, info: ResolveInfo) => PromiseOrValue<number | null | undefined>;
            export type rating = (model: User, args: {}, context: unknown, info: ResolveInfo) => PromiseOrValue<number | null | undefined>;
            export type isAdmin = (model: User, args: {}, context: unknown, info: ResolveInfo) => PromiseOrValue<boolean>;
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
            }, context: unknown, info: ResolveInfo) => PromiseOrValue<User>;
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
      export interface Node extends BaseModel {
          readonly __typename?: string;
      }
      "
    `);
    expect(resolvers).toMatchInlineSnapshot(`
      "import type { PromiseOrValue } from "@graphitation/supermassive";
      import type { ResolveInfo } from "@graphitation/supermassive";
      import type { Node } from "./models.interface";
      export declare namespace Query {
          export interface Resolvers {
              readonly node?: node;
          }
          export type node = (model: unknown, args: {
              readonly id: string;
          }, context: unknown, info: ResolveInfo) => PromiseOrValue<Node>;
      }
      "
    `);
  });

  it("generateTS with legacy compat mode", () => {
    const { models, resolvers, legacyTypes } = runGenerateTest(
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
    expect(models).toMatchInlineSnapshot(`
      "// Base type for all models. Enables automatic resolution of abstract GraphQL types (interfaces, unions)
      export interface BaseModel {
          readonly __typename?: string;
      }
      export { Type } from "./enums.interface";
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
      import type { Admin, Node, User } from "./models.interface";
      export declare namespace User {
          export interface Resolvers {
              readonly id?: id;
          }
          export type id = (model: User, args: {}, context: unknown, info: ResolveInfo) => PromiseOrValue<string>;
      }
      export declare namespace Admin {
          export interface Resolvers {
              readonly id?: id;
          }
          export type id = (model: Admin, args: {}, context: unknown, info: ResolveInfo) => PromiseOrValue<string>;
      }
      export declare namespace Users {
          export interface Resolvers {
              readonly __resolveType?: __resolveType;
          }
          export type __resolveType = (parent: Admin | User, context: unknown, info: ResolveInfo) => PromiseOrValue<"Admin" | "User" | null>;
      }
      export declare namespace Query {
          export interface Resolvers {
              readonly node?: node;
          }
          export type node = (model: unknown, args: {
              readonly id: string;
          }, context: unknown, info: ResolveInfo) => PromiseOrValue<Node>;
      }
      "
    `);
    expect(legacyTypes).toMatchInlineSnapshot(`
      "import * as Models from "./models.interface";
      import * as Resolvers from "./resolvers.interface";
      export { Node } from "./models.interface";
      export { Type } from "./models.interface";
      export { User } from "./models.interface";
      export { Admin } from "./models.interface";
      export { Users } from "./models.interface";
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
});

function runGenerateTest(
  doc: string,
  options: {
    outputPath?: string;
    documentPath?: string;
    contextImport?: string;
    contextName?: string;
    legacyCompat?: boolean;
  } = {},
): {
  models: string;
  resolvers: string;
  legacyTypes?: string;
  legacyResolvers?: string;
} {
  const fullOptions: {
    outputPath: string;
    documentPath: string;
    contextImport?: string | null;
    contextName?: string;
    legacyCompat?: boolean;
  } = {
    outputPath: "__generated__",
    documentPath: "./typedef.graphql",
    ...options,
  };
  const document = parse(doc);
  const [models, resolvers, enums, legacyTypes, legacyResolvers] = generateTS(
    document,
    fullOptions,
  ).files;
  const printer = ts.createPrinter();
  return {
    models: printer.printFile(models),
    resolvers: printer.printFile(resolvers),
    legacyTypes: legacyTypes && printer.printFile(legacyTypes),
    legacyResolvers: legacyResolvers && printer.printFile(legacyResolvers),
  };
}
