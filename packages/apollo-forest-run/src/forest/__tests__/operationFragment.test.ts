import { createTestOperation } from "../../__tests__/helpers/descriptor";
import {
  addForestTree,
  createTestForest,
} from "../../__tests__/helpers/forest";
import {
  describeOperationFragment,
  getOperationFragmentDebugName,
  resolveOperation,
} from "../../descriptor/operation";
import type {
  OperationDescriptor,
  OperationFragmentDescriptor,
  PossibleSelections,
} from "../../descriptor/types";
import type {
  EmbeddedRootAddress,
  ObjectChunk,
  RootChunkReference,
  SourceScalar,
} from "../../values/types";
import {
  createParentLocator,
  createSourceObject,
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
  AnyIndexedTree,
  ForestEnv,
  IndexedTree,
  OperationFragmentTree,
} from "../types";
import { indexOperationFragmentTree, indexTree } from "../indexTree";
import { isStoredTree } from "../predicates";
import { updateTree } from "../updateTree";
import { transformTree } from "../transformTree";
import { addTree } from "../addTree";
import { diffTree } from "../../diff/diffTree";
import {
  addDirtyField,
  addFieldDifference,
  createObjectDifference,
  createReplacement,
} from "../../diff/difference";
import { resolveNormalizedField } from "../../descriptor/resolvedSelection";
import type { ObjectDifference } from "../../diff/types";
import { assert } from "../../jsutils/assert";

const env: ForestEnv = {
  objectKey: (obj) =>
    obj.__typename && obj.id ? `${obj.__typename}:${obj.id}` : false,
};

const query = `
  {
    users {
      __typename
      id
      name
      ... @defer(label: "details") {
        bio
        friend { __typename id name }
      }
    }
  }
`;

describe(describeOperationFragment, () => {
  it("describes an inline fragment without type condition", () => {
    const operation = createTestOperation(query);
    const selection = getUsersSelection(operation);
    const descriptor = describeOperationFragment(
      operation.env,
      operation,
      selection,
    );
    expect(descriptor).toEqual({
      kind: "OperationFragment",
      operation,
      possibleSelections: selection,
      fragmentName: undefined,
      typeCondition: undefined,
    });
    expect(Object.keys(descriptor)).toEqual([
      "kind",
      "operation",
      "possibleSelections",
      "fragmentName",
      "typeCondition",
    ]);
    expect(resolveOperation(descriptor)).toBe(operation);
    expect(getOperationFragmentDebugName(descriptor)).toBe(operation.debugName);
  });

  it("describes an inline fragment with type condition", () => {
    const operation = createTestOperation(query);
    const descriptor = describeOperationFragment(
      operation.env,
      operation,
      getUsersSelection(operation),
      undefined,
      "User",
    );
    expect(descriptor.fragmentName).toBe(undefined);
    expect(descriptor.typeCondition).toBe("User");
    expect(getOperationFragmentDebugName(descriptor)).toBe(
      `${operation.debugName} ... on User`,
    );
  });

  it("describes a named fragment", () => {
    const operation = createTestOperation(`
      query UsersQuery {
        users { id ...UserDetails @defer }
      }
      fragment UserDetails on User { bio }
    `);
    const descriptor = describeOperationFragment(
      operation.env,
      operation,
      getUsersSelection(operation),
      "UserDetails",
    );
    expect(descriptor.fragmentName).toBe("UserDetails");
    expect(descriptor.typeCondition).toBe(undefined);
    expect(
      operation.fragmentMap.get(descriptor.fragmentName ?? "")?.typeCondition
        .name.value,
    ).toBe("User");
    expect(getOperationFragmentDebugName(descriptor)).toBe(
      `${operation.debugName} ...UserDetails`,
    );
  });

  it("can be shared by all objects with the same selection", () => {
    const operation = createTestOperation(query);
    const tree = indexTree(env, operation, {
      data: createSourceObject({
        users: [user("1", { bio: "a" }), user("2", { bio: "b" })],
      }),
    });
    expect(getNode(tree, "User:1").possibleSelections).toBe(
      getNode(tree, "User:2").possibleSelections,
    );
  });

  it("requires the operation env", () => {
    const operation = createTestOperation(query);
    expect(() =>
      describeOperationFragment({}, operation, getUsersSelection(operation)),
    ).toThrow();
  });
});

describe("OperationFragmentTree", () => {
  it("indexes a payload with the fragment selection in the operation context", () => {
    const { operation, fragment } = setup();
    const data = user("1", { bio: "a", friend: user("2") });
    const tree = indexOperationFragmentTree(env, fragment, "User:1", { data });

    expect(tree.kind).toBe("OperationFragment");
    expect(tree.operation).toBe(fragment);
    expect(tree.rootNodeKey).toBe("User:1");
    expect(tree.result.data).toBe(data);
    expect([...tree.nodes.keys()]).toEqual(["User:1", "User:2"]);
    expect("prev" in tree).toBe(false);
    expect("history" in tree).toBe(false);
    expect(isStoredTree(tree)).toBe(false);

    const root = getNode(tree, "User:1");
    expect(root.operation).toBe(operation);
    expect(root.possibleSelections).toBe(fragment.possibleSelections);
    expect(root.type).toBe("User");
    expect(tree.dataMap.get(data)).toEqual({
      value: root,
      parent: null,
      detached: false,
    });
  });

  it("indexes trees of different objects with the same descriptor", () => {
    const { fragment } = setup();
    const first = indexOperationFragmentTree(env, fragment, "User:1", {
      data: user("1", { bio: "a" }),
    });
    const second = indexOperationFragmentTree(env, fragment, "User:2", {
      data: user("2", { bio: "b" }),
    });
    expect(first.operation).toBe(second.operation);
    expect(first.rootNodeKey).toBe("User:1");
    expect(second.rootNodeKey).toBe("User:2");
  });

  it("keeps the kind and root key when updated", () => {
    const { fragment } = setup();
    const base = indexOperationFragmentTree(env, fragment, "User:1", {
      data: user("1", { bio: "a", friend: user("2") }),
    });
    const friend = getNode(base, "User:2");
    const { updatedTree } = updateTree(
      env,
      base,
      new Map([["User:2", nameDifference(friend, "updated")]]),
    );
    // Type-level check: updating preserves the tree kind
    const fragmentTree: OperationFragmentTree = updatedTree;

    expect(fragmentTree).not.toBe(base);
    expect(fragmentTree.kind).toBe("OperationFragment");
    expect(fragmentTree.operation).toBe(fragment);
    expect(fragmentTree.rootNodeKey).toBe("User:1");
    expect("prev" in fragmentTree).toBe(false);
    expect(fragmentTree.result.data).toEqual(
      user("1", { bio: "a", friend: user("2", { name: "updated" }) }),
    );
    const root = getNode(fragmentTree, "User:1");
    expect(root.possibleSelections).toBe(fragment.possibleSelections);
    expect(fragmentTree.dataMap.get(root.data)).toMatchObject({
      parent: null,
      detached: false,
    });
  });

  it("is re-indexed by transforms (as with merge policies)", () => {
    const { fragment } = setup();
    const base = indexOperationFragmentTree(env, fragment, "User:1", {
      data: user("1", { bio: "a", friend: null }),
    });
    const transformed: OperationFragmentTree = transformTree(
      env,
      base,
      "DESCEND",
      { types: ["User"] },
      {
        getFieldQueue: () => ["bio"],
        transformField: (_parent, _field, value) =>
          createReplacement(value, "transformed" as SourceScalar),
      },
    );
    expect(transformed.kind).toBe("OperationFragment");
    expect(transformed.rootNodeKey).toBe("User:1");
    expect(transformed.result.data).toEqual(
      user("1", { bio: "transformed", friend: null }),
    );
  });

  it("is diffed against stored trees of the operation", () => {
    const { operation, fragment } = setup();
    const stored = indexTree(env, operation, {
      data: createSourceObject({
        users: [user("1", { bio: "a", friend: user("2") })],
      }),
    });
    const forest = createTestForest();
    addForestTree(forest, stored);

    const incoming = indexOperationFragmentTree(env, fragment, "User:1", {
      data: user("1", { bio: "b", friend: user("2", { name: "new" }) }),
    });
    const difference = diffTree(forest, incoming, env);
    expect([...difference.nodeDifference.keys()].sort()).toEqual([
      "User:1",
      "User:2",
    ]);

    const { updatedTree } = updateTree(env, stored, difference.nodeDifference);
    expect(updatedTree.kind).toBe("Operation");
    expect(updatedTree.result.data).toEqual({
      users: [user("1", { bio: "b", friend: user("2", { name: "new" }) })],
    });
  });

  it("can't be used where stored trees are expected (type-level check)", () => {
    const { fragment } = setup();
    const tree = indexOperationFragmentTree(env, fragment, "User:1", {
      data: user("1", { bio: "a" }),
    });
    const forest = createTestForest();
    const anyTree: AnyIndexedTree = tree;

    // @ts-expect-error fragment trees are never stored
    const stored: IndexedTree = tree;
    // @ts-expect-error fragment descriptors are not operation descriptors
    const operation: OperationDescriptor = fragment;
    // @ts-expect-error fragment trees can't be added to the forest
    const add = () => addTree(env, forest, tree);
    // @ts-expect-error fragment descriptors can't be indexed as stored trees
    const indexStored = () => indexTree(env, fragment, { data: user("1") });

    expect(isStoredTree(anyTree)).toBe(false);
    expect(stored).toBe(tree);
    expect(operation).toBe(fragment);
    expect(add).toBeInstanceOf(Function);
    expect(indexStored).toBeInstanceOf(Function);
  });
});

describe("OperationFragmentTree with embedded root", () => {
  const embeddedQuery = `
    query Embedded {
      user(id: "1") {
        __typename
        id
        list: items(first: 2) {
          meta {
            a
            ... @defer { b nested { c } }
          }
        }
      }
    }
  `;

  function setupEmbedded() {
    const operation = createTestOperation(embeddedQuery);
    const stored = indexTree(env, operation, {
      data: createSourceObject({
        user: {
          __typename: "User",
          id: "1",
          list: [0, 1].map((i) => ({
            meta: { a: `a${i}`, b: `b${i}`, nested: { c: `c${i}` } },
          })),
        },
      }),
    });
    const forest = createTestForest();
    addForestTree(forest, stored);

    // Address of `user.list[1].meta`
    const user = getNode(stored, "User:1");
    const itemsField = user.selection.fields.get("items")?.[0];
    assert(itemsField);
    const list = resolveFieldChunk(user, itemsField);
    assert(isCompositeListValue(list));
    const item = resolveListItemChunk(list, 1);
    assert(isObjectValue(item));
    const metaField = item.selection.fields.get("meta")?.[0];
    assert(metaField?.selection);
    const address: EmbeddedRootAddress = {
      nodeKey: "User:1",
      path: [
        resolveNormalizedField(user.selection, itemsField),
        1,
        resolveNormalizedField(item.selection, metaField),
      ],
    };
    const fragment = describeOperationFragment(
      operation.env,
      operation,
      metaField.selection,
    );
    const data = createSourceObject({ b: "new", nested: { c: "new" } });
    const tree = indexOperationFragmentTree(env, fragment, address, { data });
    return { stored, forest, address, fragment, tree, data };
  }

  it("indexes the root as an embedded object and keeps its address", () => {
    const { tree, address, data } = setupEmbedded();

    expect(tree.rootNodeKey).toBe(false);
    expect(tree.nodes.size).toBe(0);
    const root = getRoot(tree);
    expect(root.key).toBe(false);
    expect(root.data).toBe(data);
    expect(tree.dataMap.get(data)).toEqual({
      value: root,
      parent: null,
      detached: false,
      embeddedIn: address,
    });
  });

  it("resolves matching embedded chunks in other trees (through lists and aliases)", () => {
    const { tree, forest } = setupEmbedded();
    const pathEnv = { findParent: createParentLocator(tree.dataMap) };
    const root = getRoot(tree);
    const nestedField = root.selection.fields.get("nested")?.[0];
    assert(nestedField);
    const nested = resolveFieldChunk(root, nestedField);
    assert(isObjectValue(nested));

    const rootRef = getGraphValueReference(pathEnv, root);
    expect(typeof rootRef).not.toBe("string");
    expect(isNodeRef(rootRef)).toBe(false);
    expect(resolveObjectKey(rootRef)).toBe(false);
    expect(
      [...getObjectChunks([forest], rootRef)].map((chunk) => chunk.data),
    ).toEqual([{ a: "a1", b: "b1", nested: { c: "c1" } }]);

    const nestedRef = getGraphValueReference(pathEnv, nested);
    expect(
      [...getObjectChunks([forest], nestedRef)].map((chunk) => chunk.data),
    ).toEqual([{ c: "c1" }]);
  });

  it("keeps the embedded root when updated and transformed", () => {
    const { tree, address } = setupEmbedded();
    const root = getRoot(tree);

    const { updatedTree } = updateTree(
      env,
      tree,
      new Map([[false, fieldDifference(root, "b", "updated")]]),
    );
    expect(updatedTree.rootNodeKey).toBe(false);
    expect(updatedTree.result.data).toEqual({
      b: "updated",
      nested: { c: "new" },
    });
    expect(updatedTree.dataMap.get(updatedTree.result.data)).toMatchObject({
      parent: null,
      embeddedIn: address,
    });

    const transformed = transformTree(
      env,
      tree,
      "DESCEND",
      {},
      {
        getFieldQueue: () => ["b"],
        transformField: (_parent, _field, value) =>
          createReplacement(value, "transformed" as SourceScalar),
      },
    );
    expect(transformed.rootNodeKey).toBe(false);
    expect(transformed.result.data).toEqual({
      b: "transformed",
      nested: { c: "new" },
    });
    expect(transformed.dataMap.get(transformed.result.data)?.parent).toBeNull();
    expect(
      (transformed.dataMap.get(transformed.result.data) as RootChunkReference)
        .embeddedIn,
    ).toEqual(address);
  });

  it("doesn't mix differences of the root and of the node it is embedded into", () => {
    const operation = createTestOperation(`
      query Cyclic {
        user(id: "1") {
          __typename
          id
          meta {
            a
            owner { __typename id name }
          }
        }
      }
    `);
    const stored = indexTree(env, operation, {
      data: createSourceObject({
        user: {
          __typename: "User",
          id: "1",
          meta: {
            a: "a",
            owner: { __typename: "User", id: "1", name: "old" },
          },
        },
      }),
    });
    const user = stored.nodes
      .get("User:1")
      ?.find((chunk) => chunk.selection.fields.has("meta"));
    assert(user);
    const metaField = user.selection.fields.get("meta")?.[0];
    assert(metaField?.selection);
    const fragment = describeOperationFragment(
      operation.env,
      operation,
      metaField.selection,
    );
    // The fragment root is embedded into User:1, and also contains User:1 itself
    const tree = indexOperationFragmentTree(
      env,
      fragment,
      {
        nodeKey: "User:1",
        path: [resolveNormalizedField(user.selection, metaField)],
      },
      {
        data: createSourceObject({
          a: "a",
          owner: { __typename: "User", id: "1", name: "old" },
        }),
      },
    );
    expect([...tree.nodes.keys()]).toEqual(["User:1"]);
    const root = getRoot(tree);
    const owner = getNode(tree, "User:1");

    const { updatedTree } = updateTree(
      env,
      tree,
      new Map<string | false, ObjectDifference>([
        [false, fieldDifference(root, "a", "root")],
        ["User:1", fieldDifference(owner, "name", "node")],
      ]),
    );
    expect(updatedTree.result.data).toEqual({
      a: "root",
      owner: { __typename: "User", id: "1", name: "node" },
    });

    const transformed = transformTree(
      env,
      tree,
      "DESCEND",
      {},
      {
        getFieldQueue: (chunk) => (chunk.key === false ? ["a"] : ["name"]),
        transformField: (parent, _field, value) =>
          createReplacement(
            value,
            (parent.key === false ? "root" : "node") as SourceScalar,
          ),
      },
    );
    expect(transformed.result.data).toEqual({
      a: "root",
      owner: { __typename: "User", id: "1", name: "node" },
    });
  });

  it("doesn't change root references of regular trees", () => {
    const { stored } = setupEmbedded();
    const rootRef = stored.dataMap.get(stored.result.data);
    expect(rootRef && "embeddedIn" in rootRef).toBe(true);
    expect((rootRef as RootChunkReference).embeddedIn).toBe(undefined);
    expect(getNode(stored, "User:1").key).toBe("User:1");
  });
});

function setup(): {
  operation: OperationDescriptor;
  fragment: OperationFragmentDescriptor;
} {
  const operation = createTestOperation(query);
  const fragment = describeOperationFragment(
    operation.env,
    operation,
    getUsersSelection(operation),
  );
  return { operation, fragment };
}

function getUsersSelection(operation: OperationDescriptor): PossibleSelections {
  const selection = operation.possibleSelections
    .get(null)
    ?.fields.get("users")?.[0].selection;
  assert(selection);
  return selection;
}

function getNode(tree: AnyIndexedTree, key: string): ObjectChunk {
  const chunks = tree.nodes.get(key);
  assert(chunks?.length === 1);
  return chunks[0];
}

function user(id: string, fields: Record<string, unknown> = {}) {
  return createSourceObject({
    __typename: "User",
    id,
    name: `User ${id}`,
    ...fields,
  });
}

function nameDifference(chunk: ObjectChunk, name: string) {
  const field = chunk.selection.fields.get("name")?.[0];
  assert(field);
  const entry = resolveNormalizedField(chunk.selection, field);
  const difference = createObjectDifference();
  addFieldDifference(
    difference,
    entry,
    createReplacement(chunk.data.name as SourceScalar, name as SourceScalar),
  );
  addDirtyField(difference, entry);
  return difference;
}

function fieldDifference(chunk: ObjectChunk, fieldName: string, value: string) {
  const field = chunk.selection.fields.get(fieldName)?.[0];
  assert(field);
  const entry = resolveNormalizedField(chunk.selection, field);
  const difference = createObjectDifference();
  addFieldDifference(
    difference,
    entry,
    createReplacement(
      chunk.data[field.dataKey] as SourceScalar,
      value as SourceScalar,
    ),
  );
  addDirtyField(difference, entry);
  return difference;
}

function getRoot(tree: AnyIndexedTree): ObjectChunk {
  const rootRef = tree.dataMap.get(tree.result.data);
  assert(rootRef && isObjectValue(rootRef.value));
  return rootRef.value;
}
