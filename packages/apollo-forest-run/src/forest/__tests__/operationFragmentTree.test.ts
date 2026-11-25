import { createTestOperation } from "../../__tests__/helpers/descriptor";
import {
  addForestTree,
  createTestForest,
} from "../../__tests__/helpers/forest";
import { describeOperationFragment } from "../../descriptor/operation";
import type {
  OperationDescriptor,
  OperationFragmentDescriptor,
} from "../../descriptor/types";
import type {
  ObjectChunk,
  SourceObject,
  SourceScalar,
} from "../../values/types";
import {
  createParentLocator,
  createSourceObject,
  findClosestNode,
  getDataPathForDebugging,
  getGraphValueReference,
  isCompositeListValue,
  isNodeRef,
  isObjectValue,
  resolveFieldChunk,
  resolveListItemChunk,
  resolveObjectKey,
} from "../../values";
import { getObjectChunks } from "../../cache/draftHelpers";
import type {
  ForestEnv,
  IndexedTree,
  OperationFragmentRoot,
  OperationFragmentTree,
} from "../types";
import { indexOperationFragmentTree, indexTree } from "../indexTree";
import { updateTree } from "../updateTree";
import { createTreeParentLocator } from "../parentLocator";
import { transformTree } from "../transformTree";
import { diffTree } from "../../diff/diffTree";
import { createReplacement, getChunkDifference } from "../../diff/difference";
import { assert } from "../../jsutils/assert";

const env: ForestEnv = {
  objectKey: (obj) =>
    obj.__typename && obj.id ? `${obj.__typename}:${obj.id}` : false,
};

describe("OperationFragmentTree with embedded roots", () => {
  const query = `
    query Embedded {
      user(id: "1") {
        __typename
        id
        list: items(first: 3) {
          meta {
            __typename
            a
            ... @defer {
              b
              nested { c }
              owner { __typename id name }
            }
          }
        }
      }
    }
  `;

  function setup(payloads: Record<number, SourceObject> = {}) {
    const operation = createTestOperation(query);
    const stored = indexTree(env, operation, {
      data: createSourceObject({
        user: {
          __typename: "User",
          id: "1",
          list: [0, 1, 2].map((i) => ({ meta: meta(i) })),
        },
      }),
    });
    const forest = createTestForest();
    addForestTree(forest, stored);

    const targets = [0, 1, 2].map((i) => getMeta(stored, i));
    const fragment = describeOperationFragment(
      operation.env,
      operation,
      targets[0].possibleSelections,
    );
    // Deferred payloads for items 0 and 2 (one tree for all objects with the fragment)
    const index = (data: Record<number, SourceObject>) =>
      indexOperationFragmentTree(
        env,
        fragment,
        createTreeParentLocator(stored),
        [0, 2].map((i) => ({ data: data[i] ?? meta(i), target: targets[i] })),
      );
    return {
      operation,
      stored,
      forest,
      targets,
      fragment,
      tree: index(payloads),
      index,
    };
  }

  it("indexes all roots in one tree with keys and types of their targets", () => {
    const { tree, fragment, operation, targets } = setup();

    expect(tree.kind).toBe("OperationFragment");
    expect(tree.operation).toBe(fragment);
    expect("result" in tree).toBe(false);
    expect("prev" in tree).toBe(false);
    expect([...tree.nodes.keys()]).toEqual(["User:1"]); // owner
    expect(tree.nodes.get("User:1")?.length).toBe(2);

    const roots = getRoots(tree);
    expect(roots.map((root) => root.key)).toEqual([false, false]);
    expect(roots.map((root) => root.type)).toEqual([
      targets[0].type,
      targets[2].type,
    ]);
    for (const root of roots) {
      expect(root.operation).toBe(operation);
      expect(root.possibleSelections).toBe(fragment.possibleSelections);
      expect(tree.dataMap.get(root.data)).toEqual({
        value: root,
        parent: null,
        detached: false,
      });
    }
    // The tree-local locator stops at roots
    const localPath = getDataPathForDebugging(
      { findParent: createParentLocator(tree.dataMap) },
      roots[1],
    );
    expect(localPath).toEqual([]);
  });

  it("resolves roots in the stored tree (through aliases, arguments and lists)", () => {
    const { tree, stored, forest } = setup();
    const findParent = createTreeParentLocator(tree);
    const [, root] = getRoots(tree);
    const nested = getField(root, "nested");
    assert(isObjectValue(nested));

    const user = getStoredUser(stored);
    expect(findClosestNode(root, findParent)).toBe(user);
    expect(findClosestNode(nested, findParent)).toBe(user);
    expect(getDataPathForDebugging({ findParent }, nested)).toEqual([
      "user",
      "list",
      2,
      "meta",
      "nested",
    ]);

    const rootRef = getGraphValueReference({ findParent }, root);
    expect(isNodeRef(rootRef)).toBe(false);
    expect(resolveObjectKey(rootRef)).toBe(false);
    expect([...getObjectChunks([forest], rootRef)]).toEqual([
      getMeta(stored, 2),
    ]);

    const nestedRef = getGraphValueReference({ findParent }, nested);
    expect(
      [...getObjectChunks([forest], nestedRef)].map((chunk) => chunk.data),
    ).toEqual([{ c: "c2" }]);

    // Nodes inside the fragment are still resolved by key
    const owner = getField(root, "owner");
    assert(isObjectValue(owner));
    expect(getGraphValueReference({ findParent }, owner)).toBe("User:1");
  });

  it("diffs all roots at once into a difference of the stored node", () => {
    const { tree: base, forest, stored, index } = setup();
    const incoming = index({
      0: meta(0, { b: "new", owner: owner("new") }),
      2: meta(2, { owner: owner("new") }),
    });

    const { nodeDifference, errors } = diffTree(forest, incoming, env);
    expect(errors).toEqual([]);
    expect([...nodeDifference.keys()]).toEqual(["User:1"]);

    const list = getField(getStoredUser(stored), "items");
    assert(isCompositeListValue(list));
    const nodeDiff = nodeDifference.get("User:1");
    const listDiff = getChunkDifference(
      nodeDifference,
      createTreeParentLocator(stored),
      list,
    );
    assert(listDiff && "dirtyItems" in listDiff);
    expect([...(listDiff.dirtyItems ?? [])]).toEqual([0]); // item 2 is not changed
    expect([...(nodeDiff?.dirtyFields ?? [])].sort()).toEqual([
      "items",
      "name",
    ]);

    // The difference is applicable to the stored tree as is
    const { updatedTree } = updateTree(env, stored, nodeDifference);
    expect(updatedTree.result.data).toEqual({
      user: {
        __typename: "User",
        id: "1",
        list: [
          { meta: meta(0, { b: "new", owner: owner("new") }) },
          { meta: meta(1, { owner: owner("new") }) },
          { meta: meta(2, { owner: owner("new") }) },
        ],
      },
    });

    // ... and to the fragment tree (unwrapped for each root)
    const updated: OperationFragmentTree = updateTree(
      env,
      base,
      nodeDifference,
    ).updatedTree;
    expect(updated.kind).toBe("OperationFragment");
    expect(updated.roots.map((root) => root.data)).toEqual(
      incoming.roots.map((root) => root.data),
    );
    expect(updated.roots.map((root) => root.target)).toEqual(
      base.roots.map((root) => root.target),
    );
  });

  it("transforms all roots at once (also when the stored node is inside the fragment)", () => {
    const { tree } = setup();
    const transformed: OperationFragmentTree = transformTree(
      env,
      tree,
      "DESCEND",
      { types: ["Meta", "User"] },
      {
        getFieldQueue: (chunk) => (chunk.type === "Meta" ? ["b"] : ["name"]),
        transformField: (parent, field, value) =>
          createReplacement(
            value,
            `${parent.data[field.dataKey]}!` as SourceScalar,
          ),
      },
    );
    expect(transformed).not.toBe(tree);
    expect(transformed.kind).toBe("OperationFragment");
    expect(transformed.roots.map((root) => root.data)).toEqual([
      meta(0, { b: "b0!", owner: owner("old!") }),
      meta(2, { b: "b2!", owner: owner("old!") }),
    ]);
    expect(getRoots(transformed).map((root) => root.key)).toEqual([
      false,
      false,
    ]);
  });

  it("returns the same tree when there are no changes for its roots", () => {
    const { tree, forest } = setup();
    const { nodeDifference } = diffTree(forest, tree, env);
    expect(nodeDifference.size).toBe(0);
    expect(updateTree(env, tree, nodeDifference).updatedTree).toBe(tree);
  });
});

describe("OperationFragmentTree with node roots", () => {
  const query = `
    {
      users {
        __typename
        id
        name
        ... @defer { bio friend { __typename id name } }
      }
    }
  `;

  function setup() {
    const operation = createTestOperation(query);
    const stored = indexTree(env, operation, {
      data: createSourceObject({
        users: ["1", "2", "3"].map((id) =>
          user(id, { bio: `bio${id}`, friend: user("9") }),
        ),
      }),
    });
    const forest = createTestForest();
    addForestTree(forest, stored);
    const targets = ["1", "2", "3"].map((id) => getNode(stored, `User:${id}`));
    const fragment = getFragment(operation, targets[0]);
    const tree = indexOperationFragmentTree(
      env,
      fragment,
      createTreeParentLocator(stored),
      targets.map((target, i) => ({
        // Payloads have no ids: keys come from targets
        data: createSourceObject({
          bio: `new${i + 1}`,
          friend: user("9", { name: "new" }),
        }),
        target,
      })),
    );
    return { stored, forest, tree };
  }

  it("keeps node keys of targets and resolves roots as nodes", () => {
    const { tree } = setup();
    const findParent = createTreeParentLocator(tree);
    const roots = getRoots(tree);
    expect(roots.map((root) => root.key)).toEqual([
      "User:1",
      "User:2",
      "User:3",
    ]);
    // Payloads have no __typename: the type of targets is used for selections and the type map
    expect(tree.typeMap.get("User")).toEqual(expect.arrayContaining(roots));
    expect(findClosestNode(roots[1], findParent)).toBe(roots[1]);
    expect(getGraphValueReference({ findParent }, roots[1])).toBe("User:2");
    expect(getDataPathForDebugging({ findParent }, roots[1])).toEqual([
      "users",
      1,
    ]);
  });

  it("is diffed, updated and transformed with a single call for all roots", () => {
    const { tree, forest, stored } = setup();
    const { nodeDifference } = diffTree(forest, tree, env);
    expect([...nodeDifference.keys()].sort()).toEqual([
      "User:1",
      "User:2",
      "User:3",
      "User:9",
    ]);
    const { updatedTree } = updateTree(env, stored, nodeDifference);
    expect(updatedTree.result.data).toEqual({
      users: ["1", "2", "3"].map((id) =>
        user(id, { bio: `new${id}`, friend: user("9", { name: "new" }) }),
      ),
    });

    const transformed = transformTree(
      env,
      tree,
      "ASCEND",
      { types: ["User"] },
      {
        getFieldQueue: () => ["bio"],
        transformField: (_parent, _field, value) =>
          value === undefined
            ? undefined
            : createReplacement(value, "x" as SourceScalar),
      },
    );
    expect(transformed.roots.map((root) => root.data.bio)).toEqual([
      "x",
      "x",
      "x",
    ]);
  });
});

function getFragment(
  operation: OperationDescriptor,
  target: ObjectChunk,
): OperationFragmentDescriptor {
  return describeOperationFragment(
    operation.env,
    operation,
    target.possibleSelections,
  );
}

function getRoots(tree: OperationFragmentTree): ObjectChunk[] {
  return tree.roots.map(({ data }: OperationFragmentRoot) => {
    const rootRef = tree.dataMap.get(data);
    assert(rootRef && isObjectValue(rootRef.value));
    return rootRef.value;
  });
}

function getNode(tree: IndexedTree, key: string): ObjectChunk {
  const chunks = tree.nodes.get(key);
  assert(chunks?.length);
  return chunks[0];
}

function getStoredUser(stored: IndexedTree): ObjectChunk {
  const user = stored.nodes
    .get("User:1")
    ?.find((chunk) => chunk.selection.fields.has("items"));
  assert(user);
  return user;
}

function getMeta(stored: IndexedTree, index: number): ObjectChunk {
  const list = getField(getStoredUser(stored), "items");
  assert(isCompositeListValue(list));
  const item = resolveListItemChunk(list, index);
  assert(isObjectValue(item));
  const value = getField(item, "meta");
  assert(isObjectValue(value));
  return value;
}

function getField(chunk: ObjectChunk, fieldName: string) {
  const field = chunk.selection.fields.get(fieldName)?.[0];
  assert(field);
  return resolveFieldChunk(chunk, field);
}

function meta(i: number, fields: Record<string, unknown> = {}) {
  return createSourceObject({
    __typename: "Meta",
    a: `a${i}`,
    b: `b${i}`,
    nested: { c: `c${i}` },
    owner: owner("old"),
    ...fields,
  });
}

function owner(name: string) {
  return createSourceObject({ __typename: "User", id: "1", name });
}

function user(id: string, fields: Record<string, unknown> = {}) {
  return createSourceObject({
    __typename: "User",
    id,
    name: `User ${id}`,
    ...fields,
  });
}
