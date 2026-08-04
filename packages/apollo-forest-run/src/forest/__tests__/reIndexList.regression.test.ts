/**
 * Regression test for a production crash observed while writing operation
 * `ComponentsChatQueriesMessageListQuery`:
 *
 *   TypeError: Cannot read properties of undefined (reading 'value')
 *     at reIndexList (packages/apollo-forest-run/src/forest/indexTree.ts)
 *     at reIndexObject (packages/apollo-forest-run/src/forest/indexTree.ts)
 *     at reIndexObject (... repeated)
 *
 * Root cause / minimal trigger
 * ----------------------------
 * `createCompositeListChunk` allocates `itemChunks` as `new Array(length)`, i.e. a
 * *sparse* array with `length` set but no elements. `indexSourceList` fills every
 * slot densely, but the lazy value resolvers do NOT:
 *
 *   - `resolveFieldChunk` materializes a list field on demand (e.g. during a
 *     `cache.diff` / read, or a merge policy) by calling `createCompositeValueChunk`
 *     -> `createCompositeListChunk`. This stores a list chunk with a *sparse*
 *     `itemChunks` into the parent object's `fieldChunks` map.
 *   - `resolveListItemChunk` then fills item slots one index at a time, and callers
 *     such as `findKeyIndex` (diffObject.ts) stop early once they find a matching
 *     key. Any un-resolved index is left as a hole.
 *
 * On the next cache write the previous tree is recycled: `indexTree(..., previousTree)`
 * -> `reIndexObject` walks the recycled object's `fieldChunks` and calls
 * `reIndexList` for the list field. `reIndexList` iterates
 * `recyclable.itemChunks.values()` and reads `itemRef.value` *without* guarding
 * against holes (unlike the sibling diagnostic `listItemTypeName` in draftHelpers.ts,
 * which uses `item?.value`). A hole yields `itemRef === undefined`, so `itemRef.value`
 * throws exactly the production error.
 *
 * The test reconstructs that precondition using only real production functions:
 *   1. `createObjectChunk` for the parent node (empty `fieldChunks`, exactly how
 *      `convert`/restore and merge policies create nodes),
 *   2. `resolveFieldChunk` to lazily materialize the list field (sparse itemChunks),
 *   3. `resolveListItemChunk` to fill one item (mirroring a read that stopped early),
 *      leaving a trailing hole,
 *   4. a second `indexTree` pass that recycles the node and hits `reIndexList`.
 */
import {
  createTestOperation,
  getFieldInfo,
} from "../../__tests__/helpers/descriptor";
import { indexTree } from "../indexTree";
import { IndexedTree, ForestEnv } from "../types";
import {
  createObjectChunk,
  createSourceObject,
  resolveFieldChunk,
  resolveListItemChunk,
  isCompositeListValue,
} from "../../values";
import {
  CompositeListChunk,
  DataMap,
  ObjectChunk,
} from "../../values/types";
import { assert } from "../../jsutils/assert";

const defaultEnv: ForestEnv = {
  objectKey: (obj: any) => obj.id,
};

const messageListQuery = `
  {
    conversation(id: "conv1") {
      __typename
      id
      messages {
        __typename
        id
        text
      }
    }
  }
`;

function buildConversationSource() {
  return createSourceObject({
    conversation: {
      __typename: "Conversation",
      id: "conv1",
      messages: [
        { __typename: "Message", id: "m1", text: "Hello" },
        { __typename: "Message", id: "m2", text: "World" },
      ],
    },
  }) as any;
}

/**
 * Builds a minimal "previous" IndexedTree whose `conversation` node carries a
 * lazily-materialized `messages` list chunk. When `fillAllItems` is false the
 * list chunk keeps a hole at the last index (the production condition).
 */
function buildRecyclableTree(
  data: any,
  fillAllItems: boolean,
): { tree: IndexedTree; listChunk: CompositeListChunk } {
  const operation = createTestOperation(messageListQuery);
  const conversationField = getFieldInfo(operation.possibleSelections, [
    "conversation",
  ]);
  const messagesField = getFieldInfo(operation.possibleSelections, [
    "conversation",
    "messages",
  ]);
  assert(conversationField.selection);

  // Nodes created by `convert`/restore/merge start with an empty `fieldChunks` map.
  const conversationChunk = createObjectChunk(
    operation,
    conversationField.selection,
    data.conversation,
    "conv1",
  );

  // Lazily materialize the list field, exactly like a read/diff does. This is the
  // ONLY place a *sparse* itemChunks array is stored back into a node.
  const listChunk = resolveFieldChunk(conversationChunk, messagesField);
  assert(isCompositeListValue(listChunk));

  // Simulate a read that resolved only the first item (e.g. `findKeyIndex` stopping
  // early after the first key match). The last index is left as a hole unless we
  // explicitly ask to fill everything (the "control" case).
  resolveListItemChunk(listChunk, 0);
  if (fillAllItems) {
    resolveListItemChunk(listChunk, 1);
  }

  const dataMap: DataMap = new Map();
  dataMap.set(data.conversation, {
    value: conversationChunk as ObjectChunk,
    parent: null as any,
    field: conversationField,
  } as any);

  const tree = {
    operation,
    result: { data },
    rootNodeKey: operation.rootNodeKey,
    nodes: new Map(),
    typeMap: new Map(),
    dataMap,
    prev: null,
    incompleteChunks: new Set(),
  } as unknown as IndexedTree;

  return { tree, listChunk };
}

describe("reIndexList with a recyclable list containing a missing item reference", () => {
  it("sanity: the recyclable list chunk has a sparse itemChunks (a hole)", () => {
    const data = buildConversationSource();
    const { listChunk } = buildRecyclableTree(data, /* fillAllItems */ false);

    // `length` reflects the source list, but the trailing slot was never resolved.
    expect(listChunk.itemChunks.length).toBe(2);
    expect(0 in listChunk.itemChunks).toBe(true);
    expect(1 in listChunk.itemChunks).toBe(false); // <- the hole
  });

  // Regression assertion (RED until the product bug is fixed).
  //
  // Recycling a previously-indexed tree during a cache write must not crash just
  // because a list field was left with an unresolved (sparse) item. Today this
  // throws the production error below, so this test currently FAILS with:
  //
  //   TypeError: Cannot read properties of undefined (reading 'value')
  //     at reIndexList (src/forest/indexTree.ts:402...)
  //     at reIndexObject (src/forest/indexTree.ts:386...)
  //
  // The fix is to guard the hole in `reIndexList` (e.g. `if (!itemRef) continue;`
  // / `const itemChunk = itemRef?.value`), mirroring `listItemTypeName` in
  // draftHelpers.ts which already uses `item?.value`. Once fixed, this passes.
  it("recycles a list with a missing item reference without crashing", () => {
    const data = buildConversationSource();
    const { tree } = buildRecyclableTree(data, /* fillAllItems */ false);
    const operation = tree.operation;

    // Second indexing/write pass recycles the previous tree. This is where the
    // production crash happens (reIndexList reads `itemRef.value` on a hole).
    expect(() =>
      indexTree(defaultEnv, operation, { data }, undefined, tree),
    ).not.toThrow();
  });

  it("documents the exact current crash (message + reIndexList/reIndexObject stack)", () => {
    const data = buildConversationSource();
    const { tree } = buildRecyclableTree(data, /* fillAllItems */ false);
    const operation = tree.operation;

    let caught: unknown;
    try {
      indexTree(defaultEnv, operation, { data }, undefined, tree);
    } catch (e) {
      caught = e;
    }

    // NOTE: this "characterization" test intentionally asserts the *current* buggy
    // behavior so the failure signature is captured next to the regression test.
    // It should be deleted (or inverted) together with the fix.
    assert(caught instanceof TypeError);
    expect(caught.message).toMatch(
      /Cannot read propert(?:y|ies) of undefined \(reading 'value'\)/,
    );
    // Crash originates in reIndexList, reached from reIndexObject (matching the
    // production stack frames `ra` <- `Fi`).
    expect(caught.stack).toContain("reIndexList");
    expect(caught.stack).toContain("reIndexObject");
  });

  it("control: no crash when every item reference is present (dense itemChunks)", () => {
    const data = buildConversationSource();
    const { tree } = buildRecyclableTree(data, /* fillAllItems */ true);
    const operation = tree.operation;

    expect(() =>
      indexTree(defaultEnv, operation, { data }, undefined, tree),
    ).not.toThrow();
  });
});
