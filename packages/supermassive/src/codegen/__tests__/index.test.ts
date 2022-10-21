import ts from "typescript";
import { parse } from "graphql";
import graphql from "../../utilities/blankGraphQLTag";
import { generateTS } from "..";

describe(generateTS, () => {
  describe("Tests basic syntax GraphQL syntax", () => {
    test("all possible nullable and non-nullable combinations", () => {
      let { resolvers, models } = runGenerateTest(graphql`
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
        "import type { AvatarModel } from \\"@msteams/packages-test\\";
        import type { PostModel as _PostModel } from \\"./post-model.interface\\";
        // Base type for all models. Enables automatic resolution of abstract GraphQL types (interfaces, unions)
        export interface BaseModel {
            __typename: string;
        }
        export interface PostModel extends BaseModel, _PostModel {
            readonly __typename: \\"Post\\";
        }
        export interface MessageModel extends BaseModel {
            readonly __typename: \\"Message\\";
            readonly id: string;
        }
        export interface UserModel extends BaseModel {
            readonly __typename: \\"User\\";
            readonly id: string;
            readonly name: string | null;
            readonly messagesWithAnswersNonRequired: ((MessageModel | null)[] | null)[] | null;
            readonly messagesWithAnswersRequired: ((MessageModel | null)[] | null)[];
            readonly messagesWithAnswersAllRequired: MessageModel[][];
            readonly messagesNonRequired: (MessageModel | null)[] | null;
            readonly messagesWithArrayRequired: (MessageModel | null)[];
            readonly messagesRequired: MessageModel[];
            readonly messagesOnlyMessageRequired: MessageModel[] | null;
            readonly post: PostModel | null;
            readonly postRequired: PostModel;
            readonly avatar: AvatarModel | null;
            readonly avatarRequired: AvatarModel;
        }
        "
      `);
      expect(resolvers).toMatchInlineSnapshot(`
        "import type { PromiseOrValue } from \\"@graphitation/supermassive\\";
        import type { ResolveInfo } from \\"@graphitation/supermassive\\";
        import type { MessageModel, PostModel, UserModel } from \\"./models.interface\\";
        import type { AvatarModel } from \\"@msteams/packages-test\\";
        export declare namespace Post {
            export type id = (model: PostModel, args: {}, context: unknown, info: ResolveInfo) => PromiseOrValue<string>;
        }
        export declare namespace Message {
            export type id = (model: MessageModel, args: {}, context: unknown, info: ResolveInfo) => PromiseOrValue<string>;
        }
        export declare namespace User {
            export type id = (model: UserModel, args: {}, context: unknown, info: ResolveInfo) => PromiseOrValue<string>;
            export type name = (model: UserModel, args: {}, context: unknown, info: ResolveInfo) => PromiseOrValue<string | null>;
            export type messagesWithAnswersNonRequired = (model: UserModel, args: {}, context: unknown, info: ResolveInfo) => PromiseOrValue<((MessageModel | null)[] | null)[] | null>;
            export type messagesWithAnswersRequired = (model: UserModel, args: {}, context: unknown, info: ResolveInfo) => PromiseOrValue<((MessageModel | null)[] | null)[]>;
            export type messagesWithAnswersAllRequired = (model: UserModel, args: {}, context: unknown, info: ResolveInfo) => PromiseOrValue<MessageModel[][]>;
            export type messagesNonRequired = (model: UserModel, args: {}, context: unknown, info: ResolveInfo) => PromiseOrValue<(MessageModel | null)[] | null>;
            export type messagesWithArrayRequired = (model: UserModel, args: {}, context: unknown, info: ResolveInfo) => PromiseOrValue<(MessageModel | null)[]>;
            export type messagesRequired = (model: UserModel, args: {}, context: unknown, info: ResolveInfo) => PromiseOrValue<MessageModel[]>;
            export type messagesOnlyMessageRequired = (model: UserModel, args: {}, context: unknown, info: ResolveInfo) => PromiseOrValue<MessageModel[] | null>;
            export type post = (model: UserModel, args: {}, context: unknown, info: ResolveInfo) => PromiseOrValue<PostModel | null>;
            export type postRequired = (model: UserModel, args: {}, context: unknown, info: ResolveInfo) => PromiseOrValue<PostModel>;
            export type avatar = (model: UserModel, args: {}, context: unknown, info: ResolveInfo) => PromiseOrValue<AvatarModel | null>;
            export type avatarRequired = (model: UserModel, args: {}, context: unknown, info: ResolveInfo) => PromiseOrValue<AvatarModel>;
        }
        export declare namespace Query {
            export type requiredUsers = (model: unknown, args: {}, context: unknown, info: ResolveInfo) => PromiseOrValue<UserModel[]>;
            export type optionalUsers = (model: unknown, args: {}, context: unknown, info: ResolveInfo) => PromiseOrValue<(UserModel | null)[] | null>;
            export type optionalUser = (model: unknown, args: {}, context: unknown, info: ResolveInfo) => PromiseOrValue<UserModel | null>;
            export type requiredUser = (model: unknown, args: {}, context: unknown, info: ResolveInfo) => PromiseOrValue<UserModel>;
            export type requiredPost = (model: unknown, args: {}, context: unknown, info: ResolveInfo) => PromiseOrValue<PostModel>;
            export type optionalPost = (model: unknown, args: {}, context: unknown, info: ResolveInfo) => PromiseOrValue<PostModel | null>;
        }
        "
      `);
    });
    test("Subscription", () => {
      let { resolvers, models } = runGenerateTest(graphql`
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
            __typename: string;
        }
        export interface UserModel extends BaseModel {
            readonly __typename: \\"User\\";
            readonly id: string;
        }
        "
      `);
      expect(resolvers).toMatchInlineSnapshot(`
        "import type { PromiseOrValue } from \\"@graphitation/supermassive\\";
        import type { ResolveInfo } from \\"@graphitation/supermassive\\";
        import type { UserModel } from \\"./models.interface\\";
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
      let { resolvers, models } = runGenerateTest(graphql`
        type User @model(from: "./user-model.interface", tsType: "UserModel") {
          id: ID!
        }

        extend type Subscription {
          userUpdated: User!
        }
      `);
      expect(resolvers).toMatchInlineSnapshot(`
        "import type { PromiseOrValue } from \\"@graphitation/supermassive\\";
        import type { ResolveInfo } from \\"@graphitation/supermassive\\";
        import type { UserModel } from \\"./models.interface\\";
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
      let { resolvers, models } = runGenerateTest(graphql`
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
            __typename: string;
        }
        export interface UserModel extends BaseModel {
            readonly __typename: \\"User\\";
            readonly id: string;
        }
        "
      `);
      expect(resolvers).toMatchInlineSnapshot(`
        "import type { PromiseOrValue } from \\"@graphitation/supermassive\\";
        import type { ResolveInfo } from \\"@graphitation/supermassive\\";
        import type { UserModel } from \\"./models.interface\\";
        export declare namespace User {
            export type id = (model: UserModel, args: {}, context: unknown, info: ResolveInfo) => PromiseOrValue<string>;
        }
        export declare namespace Query {
            export type users = (model: unknown, args: {}, context: unknown, info: ResolveInfo) => PromiseOrValue<UserModel[]>;
        }
        "
      `);
    });
    test("case when interface implements multiple interfaces", () => {
      let { resolvers, models } = runGenerateTest(graphql`
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
            __typename: string;
        }
        export interface NodeModel extends BaseModel {
            __typename: string;
        }
        export interface PersonaModel extends BaseModel {
            __typename: string;
        }
        export interface UserModel extends BaseModel, NodeModel, PersonaModel {
            __typename: string;
        }
        export interface AdminModel extends BaseModel, NodeModel, PersonaModel {
            readonly __typename: \\"Admin\\";
            readonly id: string;
            readonly rank: number;
        }
        "
      `);
      expect(resolvers).toMatchInlineSnapshot(`
        "import type { PromiseOrValue } from \\"@graphitation/supermassive\\";
        import type { ResolveInfo } from \\"@graphitation/supermassive\\";
        import type { UserModel, AdminModel, NodeModel, PersonaModel } from \\"./models.interface\\";
        export declare namespace Admin {
            export type id = (model: AdminModel, args: {}, context: unknown, info: ResolveInfo) => PromiseOrValue<string>;
            export type rank = (model: AdminModel, args: {}, context: unknown, info: ResolveInfo) => PromiseOrValue<number>;
        }
        export declare namespace Query {
            export type users = (model: unknown, args: {}, context: unknown, info: ResolveInfo) => PromiseOrValue<(UserModel | null)[] | null>;
            export type admins = (model: unknown, args: {}, context: unknown, info: ResolveInfo) => PromiseOrValue<(AdminModel | null)[] | null>;
        }
        "
      `);
    });
    test("implements", () => {
      let { resolvers, models } = runGenerateTest(graphql`
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
            __typename: string;
        }
        export interface NodeModel extends BaseModel {
            __typename: string;
        }
        export interface UserModel extends BaseModel, NodeModel {
            readonly __typename: \\"User\\";
            readonly id: string;
            readonly name: string;
        }
        "
      `);
      expect(resolvers).toMatchInlineSnapshot(`
        "import type { PromiseOrValue } from \\"@graphitation/supermassive\\";
        import type { ResolveInfo } from \\"@graphitation/supermassive\\";
        import type { UserModel, NodeModel } from \\"./models.interface\\";
        export declare namespace User {
            export type id = (model: UserModel, args: {}, context: unknown, info: ResolveInfo) => PromiseOrValue<string>;
            export type name = (model: UserModel, args: {}, context: unknown, info: ResolveInfo) => PromiseOrValue<string>;
        }
        export declare namespace Query {
            export type users = (model: unknown, args: {}, context: unknown, info: ResolveInfo) => PromiseOrValue<(UserModel | null)[] | null>;
        }
        "
      `);
    });

    test("if a type is not used it still need to be imported in resolvers", () => {
      let { resolvers, models } = runGenerateTest(graphql`
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
            __typename: string;
        }
        export interface NodeModel extends BaseModel {
            __typename: string;
        }
        export interface UserModel extends BaseModel, NodeModel {
            readonly __typename: \\"User\\";
            readonly id: string;
            readonly name: string;
        }
        "
      `);
      expect(resolvers).toMatchInlineSnapshot(`
        "import type { PromiseOrValue } from \\"@graphitation/supermassive\\";
        import type { ResolveInfo } from \\"@graphitation/supermassive\\";
        import type { NodeModel, UserModel } from \\"./models.interface\\";
        export declare namespace User {
            export type id = (model: UserModel, args: {}, context: unknown, info: ResolveInfo) => PromiseOrValue<string>;
            export type name = (model: UserModel, args: {}, context: unknown, info: ResolveInfo) => PromiseOrValue<string>;
        }
        "
      `);
    });

    test("Input", () => {
      let { resolvers, models } = runGenerateTest(graphql`
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
            __typename: string;
        }
        export interface UserModel extends BaseModel {
            readonly __typename: \\"User\\";
            readonly id: string;
        }
        "
      `);
      expect(resolvers).toMatchInlineSnapshot(`
        "import type { PromiseOrValue } from \\"@graphitation/supermassive\\";
        import type { ResolveInfo } from \\"@graphitation/supermassive\\";
        import type { UserModel } from \\"./models.interface\\";
        export declare namespace User {
            export type id = (model: UserModel, args: {}, context: unknown, info: ResolveInfo) => PromiseOrValue<string>;
        }
        export type UserParamsInput = {
            name: string | null;
        };
        export declare namespace Query {
            export type userById = (model: unknown, args: {
                params: UserParamsInput | null;
            }, context: unknown, info: ResolveInfo) => PromiseOrValue<UserModel | null>;
        }
        "
      `);
    });

    test("Input containing Enum", () => {
      let { resolvers, models } = runGenerateTest(graphql`
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
            __typename: string;
        }
        export interface UserModel extends BaseModel {
            readonly __typename: \\"User\\";
            readonly id: string;
        }
        export enum RankModel {
            User = \\"User\\",
            Admin = \\"Admin\\"
        }
        "
      `);
      expect(resolvers).toMatchInlineSnapshot(`
        "import type { PromiseOrValue } from \\"@graphitation/supermassive\\";
        import type { ResolveInfo } from \\"@graphitation/supermassive\\";
        import type { RankModel, UserModel } from \\"./models.interface\\";
        export declare namespace User {
            export type id = (model: UserModel, args: {}, context: unknown, info: ResolveInfo) => PromiseOrValue<string>;
        }
        export type UserParamsInput = {
            name: string | null;
            rank: RankModel | null;
        };
        export declare namespace Query {
            export type userById = (model: unknown, args: {
                params: UserParamsInput | null;
            }, context: unknown, info: ResolveInfo) => PromiseOrValue<UserModel | null>;
        }
        "
      `);
    });

    test("Two nested Inputs", () => {
      let { resolvers, models } = runGenerateTest(graphql`
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
            __typename: string;
        }
        export interface UserModel extends BaseModel {
            readonly __typename: \\"User\\";
            readonly id: string;
        }
        "
      `);
      expect(resolvers).toMatchInlineSnapshot(`
        "import type { PromiseOrValue } from \\"@graphitation/supermassive\\";
        import type { ResolveInfo } from \\"@graphitation/supermassive\\";
        import type { UserModel } from \\"./models.interface\\";
        export declare namespace User {
            export type id = (model: UserModel, args: {}, context: unknown, info: ResolveInfo) => PromiseOrValue<string>;
        }
        export type PresenceInput = {
            type: string;
        };
        export type UserParamsInput = {
            name: string;
            presence: PresenceInput | null;
        };
        export declare namespace Query {
            export type userById = (model: unknown, args: {
                params: UserParamsInput | null;
            }, context: unknown, info: ResolveInfo) => PromiseOrValue<UserModel | null>;
        }
        "
      `);
    });

    test("Enum", () => {
      let { resolvers, models } = runGenerateTest(graphql`
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
            __typename: string;
        }
        export enum PresenceAvailabilityModel {
            Available = \\"Available\\",
            Away = \\"Away\\",
            Offline = \\"Offline\\"
        }
        export interface UserModel extends BaseModel {
            readonly __typename: \\"User\\";
            readonly id: string;
            readonly availability: PresenceAvailabilityModel;
        }
        "
      `);
      expect(resolvers).toMatchInlineSnapshot(`
        "import type { PromiseOrValue } from \\"@graphitation/supermassive\\";
        import type { ResolveInfo } from \\"@graphitation/supermassive\\";
        import type { PresenceAvailabilityModel, UserModel } from \\"./models.interface\\";
        export declare namespace User {
            export type id = (model: UserModel, args: {}, context: unknown, info: ResolveInfo) => PromiseOrValue<string>;
            export type availability = (model: UserModel, args: {}, context: unknown, info: ResolveInfo) => PromiseOrValue<PresenceAvailabilityModel>;
        }
        export declare namespace Query {
            export type userById = (model: unknown, args: {
                id: string;
            }, context: unknown, info: ResolveInfo) => PromiseOrValue<UserModel | null>;
        }
        "
      `);
    });

    test("Union", () => {
      let { resolvers, models } = runGenerateTest(graphql`
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
            __typename: string;
        }
        export interface CustomerModel extends BaseModel {
            readonly __typename: \\"Customer\\";
            readonly id: string;
        }
        export interface AdminModel extends BaseModel {
            readonly __typename: \\"Admin\\";
            readonly id: string;
        }
        export type UserModel = CustomerModel | AdminModel;
        "
      `);
      expect(resolvers).toMatchInlineSnapshot(`
        "import type { PromiseOrValue } from \\"@graphitation/supermassive\\";
        import type { ResolveInfo } from \\"@graphitation/supermassive\\";
        import type { CustomerModel, AdminModel, UserModel } from \\"./models.interface\\";
        export declare namespace Customer {
            export type id = (model: CustomerModel, args: {}, context: unknown, info: ResolveInfo) => PromiseOrValue<string>;
        }
        export declare namespace Admin {
            export type id = (model: AdminModel, args: {}, context: unknown, info: ResolveInfo) => PromiseOrValue<string>;
        }
        export declare namespace Query {
            export type userById = (model: unknown, args: {
                id: string;
            }, context: unknown, info: ResolveInfo) => PromiseOrValue<UserModel | null>;
        }
        "
      `);
    });
  });
  describe("Models", () => {
    it('should import the model and use it in User type"', () => {
      let { resolvers, models } = runGenerateTest(graphql`
        type User @model(from: "./user-model.interface", tsType: "UserModel") {
          id: ID!
        }

        extend type Query {
          userById(id: ID!): User
        }
      `);
      expect(models).toMatchInlineSnapshot(`
        "import type { UserModel as _UserModel } from \\"./user-model.interface\\";
        // Base type for all models. Enables automatic resolution of abstract GraphQL types (interfaces, unions)
        export interface BaseModel {
            __typename: string;
        }
        export interface UserModel extends BaseModel, _UserModel {
            readonly __typename: \\"User\\";
        }
        "
      `);
      expect(resolvers).toMatchInlineSnapshot(`
        "import type { PromiseOrValue } from \\"@graphitation/supermassive\\";
        import type { ResolveInfo } from \\"@graphitation/supermassive\\";
        import type { UserModel } from \\"./models.interface\\";
        export declare namespace User {
            export type id = (model: UserModel, args: {}, context: unknown, info: ResolveInfo) => PromiseOrValue<string>;
        }
        export declare namespace Query {
            export type userById = (model: unknown, args: {
                id: string;
            }, context: unknown, info: ResolveInfo) => PromiseOrValue<UserModel | null>;
        }
        "
      `);
    });
  });

  describe("Import", () => {
    it("shouldn't include Query, Mutation and Subscription in the models", () => {
      let { resolvers, models } = runGenerateTest(graphql`
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
            __typename: string;
        }
        export interface TodoModel extends BaseModel {
            readonly __typename: \\"Todo\\";
            readonly id: string;
            readonly name: string;
        }
        "
      `);
      expect(resolvers).toMatchInlineSnapshot(`
        "import type { PromiseOrValue } from \\"@graphitation/supermassive\\";
        import type { ResolveInfo } from \\"@graphitation/supermassive\\";
        import type { TodoModel } from \\"./models.interface\\";
        export declare namespace Query {
            export type allTodos = (model: unknown, args: {}, context: unknown, info: ResolveInfo) => PromiseOrValue<TodoModel[]>;
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
      let { resolvers, models } = runGenerateTest(graphql`
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
        "import type { AvatarModel } from \\"@msteams/packages-test\\";
        // Base type for all models. Enables automatic resolution of abstract GraphQL types (interfaces, unions)
        export interface BaseModel {
            __typename: string;
        }
        export interface UserModel extends BaseModel {
            readonly __typename: \\"User\\";
            readonly id: string;
            readonly avatar: AvatarModel;
        }
        "
      `);
      expect(resolvers).toMatchInlineSnapshot(`
        "import type { PromiseOrValue } from \\"@graphitation/supermassive\\";
        import type { ResolveInfo } from \\"@graphitation/supermassive\\";
        import type { UserModel } from \\"./models.interface\\";
        import type { AvatarModel } from \\"@msteams/packages-test\\";
        export declare namespace User {
            export type id = (model: UserModel, args: {}, context: unknown, info: ResolveInfo) => PromiseOrValue<string>;
            export type avatar = (model: UserModel, args: {}, context: unknown, info: ResolveInfo) => PromiseOrValue<AvatarModel>;
        }
        export declare namespace Query {
            export type userById = (model: unknown, args: {
                id: string;
            }, context: unknown, info: ResolveInfo) => PromiseOrValue<UserModel | null>;
        }
        "
      `);
    });
  });

  describe("Scalars", () => {
    it('expects custom scalars "DateTime" to be "string"', () => {
      let { resolvers, models } = runGenerateTest(graphql`
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
            __typename: string;
        }
        export type DateTimeModel = string;
        export interface UserModel extends BaseModel {
            readonly __typename: \\"User\\";
            readonly id: string;
            readonly dateTime: DateTimeModel;
        }
        "
      `);
      expect(resolvers).toMatchInlineSnapshot(`
        "import type { PromiseOrValue } from \\"@graphitation/supermassive\\";
        import type { ResolveInfo } from \\"@graphitation/supermassive\\";
        import type { DateTimeModel, UserModel } from \\"./models.interface\\";
        export declare namespace User {
            export type id = (model: UserModel, args: {}, context: unknown, info: ResolveInfo) => PromiseOrValue<string>;
            export type dateTime = (model: UserModel, args: {}, context: unknown, info: ResolveInfo) => PromiseOrValue<DateTimeModel>;
        }
        export declare namespace Query {
            export type userById = (model: unknown, args: {
                id: string;
            }, context: unknown, info: ResolveInfo) => PromiseOrValue<UserModel | null>;
        }
        "
      `);
    });
    it('expects custom scalars "DateTime" to be model', () => {
      let { resolvers, models } = runGenerateTest(graphql`
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
        "import type { DateTimeModel as _DateTimeModel } from \\"@msteams/custom-scalars\\";
        // Base type for all models. Enables automatic resolution of abstract GraphQL types (interfaces, unions)
        export interface BaseModel {
            __typename: string;
        }
        export type DateTimeModel = _DateTimeModel;
        export interface UserModel extends BaseModel {
            readonly __typename: \\"User\\";
            readonly id: string;
            readonly dateTime: DateTimeModel;
        }
        "
      `);
      expect(resolvers).toMatchInlineSnapshot(`
        "import type { PromiseOrValue } from \\"@graphitation/supermassive\\";
        import type { ResolveInfo } from \\"@graphitation/supermassive\\";
        import type { DateTimeModel, UserModel } from \\"./models.interface\\";
        export declare namespace User {
            export type id = (model: UserModel, args: {}, context: unknown, info: ResolveInfo) => PromiseOrValue<string>;
            export type dateTime = (model: UserModel, args: {}, context: unknown, info: ResolveInfo) => PromiseOrValue<DateTimeModel>;
        }
        export declare namespace Query {
            export type userById = (model: unknown, args: {
                id: string;
            }, context: unknown, info: ResolveInfo) => PromiseOrValue<UserModel | null>;
        }
        "
      `);
    });
    it("expects built-in scalars to not be generated in models and typescript types used directly in resolvers", () => {
      let { resolvers, models } = runGenerateTest(graphql`
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
            __typename: string;
        }
        export interface UserModel extends BaseModel {
            readonly __typename: \\"User\\";
            readonly id: string;
            readonly name: string;
            readonly age: number | null;
            readonly rating: number | null;
            readonly isAdmin: boolean;
        }
        "
      `);
      expect(resolvers).toMatchInlineSnapshot(`
        "import type { PromiseOrValue } from \\"@graphitation/supermassive\\";
        import type { ResolveInfo } from \\"@graphitation/supermassive\\";
        import type { UserModel } from \\"./models.interface\\";
        export declare namespace User {
            export type id = (model: UserModel, args: {}, context: unknown, info: ResolveInfo) => PromiseOrValue<string>;
            export type name = (model: UserModel, args: {}, context: unknown, info: ResolveInfo) => PromiseOrValue<string>;
            export type age = (model: UserModel, args: {}, context: unknown, info: ResolveInfo) => PromiseOrValue<number | null>;
            export type rating = (model: UserModel, args: {}, context: unknown, info: ResolveInfo) => PromiseOrValue<number | null>;
            export type isAdmin = (model: UserModel, args: {}, context: unknown, info: ResolveInfo) => PromiseOrValue<boolean>;
        }
        export declare namespace Query {
            export type node = (model: unknown, args: {
                id: string;
                name: string;
                age: number | null;
                rating: number | null;
                isAdmin: boolean | null;
            }, context: unknown, info: ResolveInfo) => PromiseOrValue<UserModel>;
        }
        "
      `);
    });
  });

  it("generateTS without ContextName and ContextImport", () => {
    let { models, resolvers } = runGenerateTest(graphql`
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
          __typename: string;
      }
      export interface NodeModel extends BaseModel {
          __typename: string;
      }
      "
    `);
    expect(resolvers).toMatchInlineSnapshot(`
      "import type { PromiseOrValue } from \\"@graphitation/supermassive\\";
      import type { ResolveInfo } from \\"@graphitation/supermassive\\";
      import type { NodeModel } from \\"./models.interface\\";
      export declare namespace Query {
          export type node = (model: unknown, args: {
              id: string;
          }, context: unknown, info: ResolveInfo) => PromiseOrValue<NodeModel>;
      }
      "
    `);
  });
});

function runGenerateTest(
  doc: string,
  contextImport?: string,
  contextName?: string,
): { models: string; resolvers: string } {
  let document = parse(doc);
  let result = generateTS(document, contextImport, contextName);
  let printer = ts.createPrinter();
  return {
    models: printer.printFile(result.models),
    resolvers: printer.printFile(result.resolvers),
  };
}
