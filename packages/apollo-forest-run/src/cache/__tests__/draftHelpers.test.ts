import { getEmbeddedObjectChunks } from "../draftHelpers";
import { generateChunk } from "../../__tests__/helpers/values";
import {
  createParentLocator,
  getGraphValueReference,
} from "../../values/traverse";
import { resolveFieldValue } from "../../values/resolve";
import { CompositeListChunk, NodeChunk } from "../../values/types";

describe("getEmbeddedObjectChunks invariant", () => {
  it("reports operation and path when the embedded value is a list", () => {
    const query = `query EmbeddedListTest {
      node {
        __typename @mock(value: "Node")
        id
        items @mock(count: 2) {
          __typename @mock(value: "Item")
          value
        }
      }
    }`;
    const { value: root, dataMap } = generateChunk(query);
    const env = { findParent: createParentLocator(dataMap) };

    const node = resolveFieldValue(root, "node") as NodeChunk;
    const items = resolveFieldValue(node, "items") as CompositeListChunk;

    // The reference resolves to a composite list, but getEmbeddedObjectChunks
    // expects an embedded object at that location.
    const ref = getGraphValueReference(env, items);

    expect(() => [...getEmbeddedObjectChunks(env, [node], ref)]).toThrow(
      'Invariant violation: Failed to resolve embedded object in "query EmbeddedListTest" at path node.items (in Node): expected an embedded object, got a list of Item',
    );
  });
});
