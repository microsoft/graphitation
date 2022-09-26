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
        "import { AvatarModel } from \\"@msteams/packages-test\\";
        import { PostModel as _PostModel } from \\"./post-model.interface\\";
        export type BaseModel = {
            __typename: string;
        };
        export interface PostModel extends BaseModel, _PostModel {
            __typename: \\"Post\\";
        }
        export interface MessageModel extends BaseModel {
            __typename: \\"Message\\";
            id: string;
        }
        export interface UserModel extends BaseModel {
            __typename: \\"User\\";
            id: string;
            name: string | null;
            messagesNonRequired: (MessageModel | null)[] | null;
            messagesWithArrayRequired: (MessageModel | null)[];
            messagesRequired: MessageModel[];
            messagesOnlyMessageRequired: MessageModel[] | null;
            post: PostModel | null;
            postRequired: PostModel;
            avatar: AvatarModel | null;
            avatarRequired: AvatarModel;
        }
        "
      `);
      expect(resolvers).toMatchInlineSnapshot(`
        "import type { PromiseOrValue } from \\"@graphitation/supermassive\\";
        import type { ResolveInfo } from \\"@graphitation/supermassive\\";
        import type { PostModel, MessageModel, UserModel } from \\"./models.interface.ts\\";
        import { AvatarModel } from \\"@msteams/packages-test\\";
        export declare namespace Post {
            export type id = (model: PostModel, args: {}, context: unknown, info: ResolveInfo) => PromiseOrValue<string>;
        }
        export declare namespace Message {
            export type id = (model: MessageModel, args: {}, context: unknown, info: ResolveInfo) => PromiseOrValue<string>;
        }
        export declare namespace User {
            export type id = (model: UserModel, args: {}, context: unknown, info: ResolveInfo) => PromiseOrValue<string>;
            export type name = (model: UserModel, args: {}, context: unknown, info: ResolveInfo) => PromiseOrValue<string | null>;
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
        "export type BaseModel = {
            __typename: string;
        };
        export interface UserModel extends BaseModel {
            __typename: \\"User\\";
            id: string;
        }
        "
      `);
      expect(resolvers).toMatchInlineSnapshot(`
        "import type { PromiseOrValue } from \\"@graphitation/supermassive\\";
        import type { ResolveInfo } from \\"@graphitation/supermassive\\";
        import type { UserModel } from \\"./models.interface.ts\\";
        export declare namespace User {
            export type id = (model: UserModel, args: {}, context: unknown, info: ResolveInfo) => PromiseOrValue<string>;
        }
        export declare namespace Query {
            export type users = (model: unknown, args: {}, context: unknown, info: ResolveInfo) => PromiseOrValue<UserModel[]>;
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
        "export type BaseModel = {
            __typename: string;
        };
        export interface NodeModel extends BaseModel {
            __typename: string;
        }
        export interface UserModel extends BaseModel, NodeModel {
            __typename: \\"User\\";
            id: string;
            name: string;
        }
        "
      `);
      expect(resolvers).toMatchInlineSnapshot(`
        "import type { PromiseOrValue } from \\"@graphitation/supermassive\\";
        import type { ResolveInfo } from \\"@graphitation/supermassive\\";
        import type { NodeModel, UserModel } from \\"./models.interface.ts\\";
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
        "export type BaseModel = {
            __typename: string;
        };
        export interface NodeModel extends BaseModel {
            __typename: string;
        }
        export interface UserModel extends BaseModel, NodeModel {
            __typename: \\"User\\";
            id: string;
            name: string;
        }
        "
      `);
      expect(resolvers).toMatchInlineSnapshot(`
        "import type { PromiseOrValue } from \\"@graphitation/supermassive\\";
        import type { ResolveInfo } from \\"@graphitation/supermassive\\";
        import type { NodeModel, UserModel } from \\"./models.interface.ts\\";
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
        "export type BaseModel = {
            __typename: string;
        };
        export interface UserModel extends BaseModel {
            __typename: \\"User\\";
            id: string;
        }
        "
      `);
      expect(resolvers).toMatchInlineSnapshot(`
        "import type { PromiseOrValue } from \\"@graphitation/supermassive\\";
        import type { ResolveInfo } from \\"@graphitation/supermassive\\";
        import type { UserModel } from \\"./models.interface.ts\\";
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
        "export type BaseModel = {
            __typename: string;
        };
        export interface UserModel extends BaseModel {
            __typename: \\"User\\";
            id: string;
        }
        "
      `);
      expect(resolvers).toMatchInlineSnapshot(`
        "import type { PromiseOrValue } from \\"@graphitation/supermassive\\";
        import type { ResolveInfo } from \\"@graphitation/supermassive\\";
        import type { UserModel } from \\"./models.interface.ts\\";
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
        enum PresenceAvailabilityModel {
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
        "export type BaseModel = {
            __typename: string;
        };
        export enum PresenceAvailabilityModelModel {
            Available = \\"Available\\",
            Away = \\"Away\\",
            Offline = \\"Offline\\"
        }
        export interface UserModel extends BaseModel {
            __typename: \\"User\\";
            id: string;
            availability: PresenceAvailabilityModel;
        }
        "
      `);
      expect(resolvers).toMatchInlineSnapshot(`
        "import type { PromiseOrValue } from \\"@graphitation/supermassive\\";
        import type { ResolveInfo } from \\"@graphitation/supermassive\\";
        import type { UserModel, PresenceAvailabilityModel } from \\"./models.interface.ts\\";
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
        "export type BaseModel = {
            __typename: string;
        };
        export interface CustomerModel extends BaseModel {
            __typename: \\"Customer\\";
            id: string;
        }
        export interface AdminModel extends BaseModel {
            __typename: \\"Admin\\";
            id: string;
        }
        export type UserModel = CustomerModel | AdminModel;
        "
      `);
      expect(resolvers).toMatchInlineSnapshot(`
        "import type { PromiseOrValue } from \\"@graphitation/supermassive\\";
        import type { ResolveInfo } from \\"@graphitation/supermassive\\";
        import type { CustomerModel, AdminModel, UserModel } from \\"./models.interface.ts\\";
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
        "import { UserModel as _UserModel } from \\"./user-model.interface\\";
        export type BaseModel = {
            __typename: string;
        };
        export interface UserModel extends BaseModel, _UserModel {
            __typename: \\"User\\";
        }
        "
      `);
      expect(resolvers).toMatchInlineSnapshot(`
        "import type { PromiseOrValue } from \\"@graphitation/supermassive\\";
        import type { ResolveInfo } from \\"@graphitation/supermassive\\";
        import type { UserModel } from \\"./models.interface.ts\\";
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
        "import { AvatarModel } from \\"@msteams/packages-test\\";
        export type BaseModel = {
            __typename: string;
        };
        export interface UserModel extends BaseModel {
            __typename: \\"User\\";
            id: string;
            avatar: AvatarModel;
        }
        "
      `);
      expect(resolvers).toMatchInlineSnapshot(`
        "import type { PromiseOrValue } from \\"@graphitation/supermassive\\";
        import type { ResolveInfo } from \\"@graphitation/supermassive\\";
        import type { UserModel } from \\"./models.interface.ts\\";
        import { AvatarModel } from \\"@msteams/packages-test\\";
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
        "export type BaseModel = {
            __typename: string;
        };
        export type DateTime = DateTimeModel;
        export type DateTimeModel = string;
        export interface UserModel extends BaseModel {
            __typename: \\"User\\";
            id: string;
            dateTime: DateTimeModel;
        }
        "
      `);
      expect(resolvers).toMatchInlineSnapshot(`
        "import type { PromiseOrValue } from \\"@graphitation/supermassive\\";
        import type { ResolveInfo } from \\"@graphitation/supermassive\\";
        import type { DateTime, UserModel } from \\"./models.interface.ts\\";
        export declare namespace User {
            export type id = (model: UserModel, args: {}, context: unknown, info: ResolveInfo) => PromiseOrValue<string>;
            export type dateTime = (model: UserModel, args: {}, context: unknown, info: ResolveInfo) => PromiseOrValue<DateTime>;
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
        "import { DateTimeModel as _DateTimeModel } from \\"@msteams/custom-scalars\\";
        export type BaseModel = {
            __typename: string;
        };
        export type DateTime = _DateTimeModel;
        export type _DateTimeModel = DateTimeModel;
        export interface UserModel extends BaseModel {
            __typename: \\"User\\";
            id: string;
            dateTime: _DateTimeModel;
        }
        "
      `);
      expect(resolvers).toMatchInlineSnapshot(`
        "import type { PromiseOrValue } from \\"@graphitation/supermassive\\";
        import type { ResolveInfo } from \\"@graphitation/supermassive\\";
        import type { DateTime, UserModel } from \\"./models.interface.ts\\";
        export declare namespace User {
            export type id = (model: UserModel, args: {}, context: unknown, info: ResolveInfo) => PromiseOrValue<string>;
            export type dateTime = (model: UserModel, args: {}, context: unknown, info: ResolveInfo) => PromiseOrValue<DateTime>;
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
        "export type BaseModel = {
            __typename: string;
        };
        export interface UserModel extends BaseModel {
            __typename: \\"User\\";
            id: string;
            name: string;
            age: number | null;
            rating: number | null;
            isAdmin: boolean;
        }
        "
      `);
      expect(resolvers).toMatchInlineSnapshot(`
        "import type { PromiseOrValue } from \\"@graphitation/supermassive\\";
        import type { ResolveInfo } from \\"@graphitation/supermassive\\";
        import type { UserModel } from \\"./models.interface.ts\\";
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
      "export type BaseModel = {
          __typename: string;
      };
      export interface NodeModel extends BaseModel {
          __typename: string;
      }
      "
    `);
    expect(resolvers).toMatchInlineSnapshot(`
      "import type { PromiseOrValue } from \\"@graphitation/supermassive\\";
      import type { ResolveInfo } from \\"@graphitation/supermassive\\";
      import type { NodeModel } from \\"./models.interface.ts\\";
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
