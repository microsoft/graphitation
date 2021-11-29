import { graphql } from "@graphitation/graphql-js-tag";
import { extractMetadataTransform } from "./extractMetadataTransform";

describe(extractMetadataTransform, () => {
  describe("concerning the root of resolved watch query data", () => {
    it("indicates the watch data starts at the node field", () => {
      const result = extractMetadataTransform(graphql`
        query WatchQueryOnNodeType {
          node(id: $id) {
            ...SomeFragment
          }
        }
      `);
      expect(result?.rootSelection).toEqual("node");
    });

    it("indicates the watch data starting at the root by not emitting a root field selection", () => {
      const result = extractMetadataTransform(graphql`
        query WatchQueryOnQueryType {
          ...SomeFragment
          __fragments @client
        }
      `);
      expect(result).toBeUndefined();
    });
  });
});
