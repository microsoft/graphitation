import { generateResolvers } from "../resolvers";
import ts from "typescript";
import { parse } from "graphql";
import graphql from "../../utilities/blankGraphQLTag";
import { extractContext } from "../context";
import { generateTS } from "..";

describe(generateTS, () => {
  it("kitchen sink", () => {
    let { models, resolvers } = runGenerateTest(graphql`
      extend schema @import(from: "@msteams/packages-test", defs: ["Avatar"])

      interface Node {
        id: ID!
      }

      type User implements Node {
        id: ID!
        name: String
        presence: Presence
        avatar: Avatar
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
      }
    `);
    expect(models).toMatchInlineSnapshot(`
      "import { AvatarModel } from \\"@msteams/packages-test\\";
      import { PresenceModel as _PresenceModel } from \\"./presence-model.interface\\";
      export interface NodeModel extends {
        __typeName: string;
      }
      export interface UserModel extends BaseModel, NodeModel {
          __typeName: \\"User\\";
          id: string;
          name: string | null;
          presence: PresenceModel | null;
          avatar: AvatarModel | null;
      }
      export interface PresenceModel extends BaseModel, NodeModel, _PresenceModel {
          __typeName: \\"Presence\\";
      }
      export enum PresenceAvailabilityModel {
          Available = \\"Available\\",
          Away = \\"Away\\",
          Offline = \\"Offline\\"
      }
      export type FooUnionModel = PresenceModel | UserModel
      "
    `);
    expect(resolvers).toMatchInlineSnapshot(`
      "import type { PromiseOrValue } from \\"@graphitation/supermassive\\";
      import type { ResolveInfo } from \\"@graphitation/supermassive\\";
      import type * as models from \\"./models.interface.ts\\";
      import * as NSMsteamsPackagesTest from \\"@msteams/packages-test\\";
      export declare module User {
          export type id = (model: models.UserModel, args: {}, context: Context, info: ResolveInfo) => PromiseOrValue<string>;
          export type name = (model: models.UserModel, args: {}, context: Context, info: ResolveInfo) => PromiseOrValue<string | null>;
          export type presence = (model: models.UserModel, args: {}, context: Context, info: ResolveInfo) => PromiseOrValue<models.PresenceModel | null>;
          export type avatar = (model: models.UserModel, args: {}, context: Context, info: ResolveInfo) => PromiseOrValue<NSMsteamsPackagesTest.AvatarModel | null>;
      }
      export declare module Presence {
          export type id = (model: models.PresenceModel, args: {}, context: Context, info: ResolveInfo) => PromiseOrValue<string>;
          export type availability = (model: models.PresenceModel, args: {}, context: Context, info: ResolveInfo) => PromiseOrValue<models.PresenceAvailabilityModel>;
      }
      export declare module Query {
          export type userById = (model: unknown, args: {
              id: string;
          }, context: Context, info: ResolveInfo) => PromiseOrValue<models.UserModel | null>;
      }
      "
    `);
  });
});

function runGenerateTest(doc: string): { models: string; resolvers: string } {
  let document = parse(doc);
  let result = generateTS(document);
  let printer = ts.createPrinter();
  return {
    models: printer.printFile(result.models),
    resolvers: printer.printFile(result.resolvers),
  };
}
