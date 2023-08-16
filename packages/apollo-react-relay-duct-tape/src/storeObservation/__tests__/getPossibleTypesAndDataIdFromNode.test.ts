import { buildSchema } from "graphql";
import * as fs from "fs";
import * as path from "path";
import { getPossibleTypesAndDataIdFromNode } from "../getPossibleTypesAndDataIdFromNode";

const schema = buildSchema(
  fs.readFileSync(
    path.resolve(__dirname, "../../__tests__/schema.graphql"),
    "utf8",
  ),
);

describe(getPossibleTypesAndDataIdFromNode, () => {
  const { possibleTypes, dataIdFromNode } =
    getPossibleTypesAndDataIdFromNode(schema);

  describe("concerning dataIdFromObject", () => {
    it("returns the id of a node", () => {
      expect(
        dataIdFromNode(
          {
            __typename: "User",
            id: "User:1",
          },
          undefined as any,
        ),
      ).toEqual("User:1");
    });

    it("returns the id of a node derived interface", () => {
      expect(
        dataIdFromNode(
          {
            __typename: "NodeWithPetAvatarAndConversations",
            id: "NodeWithPetAvatarAndConversations:1",
          },
          undefined as any,
        ),
      ).toEqual("NodeWithPetAvatarAndConversations:1");
    });
  });

  describe("concerning possibleTypes", () => {
    it("returns members of unions", () => {
      expect(possibleTypes["SearchResult"]).toMatchInlineSnapshot(`
        [
          "User",
          "Contact",
          "Conversation",
          "Message",
        ]
      `);
    });

    it("returns implementations of interfaces, including other interfaces", () => {
      expect(possibleTypes["Node"]).toMatchInlineSnapshot(`
        [
          "User",
          "Contact",
          "Conversation",
          "Message",
          "NodeWithPetAvatarAndConversations",
        ]
      `);
    });
  });
});
