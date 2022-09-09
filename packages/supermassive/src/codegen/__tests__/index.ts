import ts from "typescript";
import { parse } from "graphql";
import graphql from "../../utilities/blankGraphQLTag";
import { generateTS } from "..";

describe(generateTS, () => {
  it("kitchen sink", () => {
    let { models, resolvers } = runGenerateTest(
      graphql`
      extend schema @import(from: "@msteams/packages-test", defs: ["Avatar"])

      scalar DateTime @model(tsType: "string")
      
      interface Node {
        id: ID!
      }

      type User implements Node {
        id: ID!
        name: String!
        dateTime: DateTime!
        presence: Presence
        avatar: Avatar
      }

      input UserParamsInput {
        name: String
      }

      input PresenceInput {
        userId: ID!
        dateTime: DateTime
        userParams: UserParamsInput!
      }

      type Presence implements Node
        @model(from: "./presence-model.interface", tsType: "PresenceModel") {
        id: ID!
        availability: PresenceAvailability!
      }

      enum PresenceAvailability {
        Available
        Away
        Offline
      }

      extend type Query {
        node(id: ID!): Node
        userById(id: ID!): User
        presence(params: PresenceInput!): User
      }

      union FooUnion = Presence | User
    `,
      "@msteams/context",
      "Context",
    );
    expect(models).toMatchInlineSnapshot(`
      "import { AvatarModel } from \\"@msteams/packages-test\\";
      import { PresenceModel as _PresenceModel } from \\"./presence-model.interface\\";
      export type BaseModel = {
          __typename: string;
      };
      export type ID = string;
      export type Int = number;
      export type Float = number;
      export type String = string;
      export type Boolean = boolean;
      export type DateTime = DateTimeModel;
      export type DateTimeModel = string;
      export interface NodeModel extends BaseModel {
          __typename: string;
      }
      export interface UserModel extends BaseModel, NodeModel {
          __typename: \\"User\\";
          id: string;
          name: string;
          dateTime: DateTimeModel;
          presence: PresenceModel | null;
          avatar: AvatarModel | null;
      }
      export interface PresenceModel extends BaseModel, _PresenceModel, NodeModel {
          __typename: \\"Presence\\";
      }
      export enum PresenceAvailabilityModel {
          Available = \\"Available\\",
          Away = \\"Away\\",
          Offline = \\"Offline\\"
      }
      export type FooUnionModel = PresenceModel | UserModel;
      "
    `);
    expect(resolvers).toMatchInlineSnapshot(`
      "import type { PromiseOrValue } from \\"@graphitation/supermassive\\";
      import type { ResolveInfo } from \\"@graphitation/supermassive\\";
      import type { Context } from \\"@msteams/context\\";
      import type { ID, String, DateTime, NodeModel, PresenceModel, PresenceAvailabilityModel, UserModel } from \\"./models.interface.ts\\";
      import { AvatarModel } from \\"@msteams/packages-test\\";
      export declare namespace User {
          export type id = (model: UserModel, args: {}, context: Context, info: ResolveInfo) => PromiseOrValue<ID>;
          export type name = (model: UserModel, args: {}, context: Context, info: ResolveInfo) => PromiseOrValue<String>;
          export type dateTime = (model: UserModel, args: {}, context: Context, info: ResolveInfo) => PromiseOrValue<DateTime>;
          export type presence = (model: UserModel, args: {}, context: Context, info: ResolveInfo) => PromiseOrValue<PresenceModel | null>;
          export type avatar = (model: UserModel, args: {}, context: Context, info: ResolveInfo) => PromiseOrValue<AvatarModel | null>;
      }
      export type UserParamsInput = {
          name: String | null;
      };
      export type PresenceInput = {
          userId: ID;
          dateTime: DateTime | null;
          userParams: UserParamsInput;
      };
      export declare namespace Presence {
          export type id = (model: PresenceModel, args: {}, context: Context, info: ResolveInfo) => PromiseOrValue<ID>;
          export type availability = (model: PresenceModel, args: {}, context: Context, info: ResolveInfo) => PromiseOrValue<PresenceAvailabilityModel>;
      }
      export declare namespace Query {
          export type node = (model: unknown, args: {
              id: ID;
          }, context: Context, info: ResolveInfo) => PromiseOrValue<NodeModel | null>;
          export type userById = (model: unknown, args: {
              id: ID;
          }, context: Context, info: ResolveInfo) => PromiseOrValue<UserModel | null>;
          export type presence = (model: unknown, args: {
              params: PresenceInput;
          }, context: Context, info: ResolveInfo) => PromiseOrValue<UserModel | null>;
      }
      "
    `);
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
      export type ID = string;
      export type Int = number;
      export type Float = number;
      export type String = string;
      export type Boolean = boolean;
      export interface NodeModel extends BaseModel {
          __typename: string;
      }
      "
    `);
    expect(resolvers).toMatchInlineSnapshot(`
      "import type { PromiseOrValue } from \\"@graphitation/supermassive\\";
      import type { ResolveInfo } from \\"@graphitation/supermassive\\";
      import type { ID, NodeModel } from \\"./models.interface.ts\\";
      export declare namespace Query {
          export type node = (model: unknown, args: {
              id: ID;
          }, context: unknown, info: ResolveInfo) => PromiseOrValue<NodeModel>;
      }
      "
    `);
  });

  it("generateTS with optional parameter in the Query", () => {
    let { models, resolvers } = runGenerateTest(graphql`
      interface Node {
        id: ID
      }

      extend type Query {
        node(id: ID): Node
      }
    `);
    expect(models).toMatchInlineSnapshot(`
      "export type BaseModel = {
          __typename: string;
      };
      export type ID = string;
      export type Int = number;
      export type Float = number;
      export type String = string;
      export type Boolean = boolean;
      export interface NodeModel extends BaseModel {
          __typename: string;
      }
      "
    `);
    expect(resolvers).toMatchInlineSnapshot(`
      "import type { PromiseOrValue } from \\"@graphitation/supermassive\\";
      import type { ResolveInfo } from \\"@graphitation/supermassive\\";
      import type { ID, NodeModel } from \\"./models.interface.ts\\";
      export declare namespace Query {
          export type node = (model: unknown, args: {
              id: ID | null;
          }, context: unknown, info: ResolveInfo) => PromiseOrValue<NodeModel | null>;
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
