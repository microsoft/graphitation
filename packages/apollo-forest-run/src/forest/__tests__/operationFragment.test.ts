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
import type { ObjectChunk, SourceScalar } from "../../values/types";
import { createSourceObject } from "../../values";
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
    expect(tree.history.items).toEqual([]);
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

  it("uses the given root key for objects without own keys", () => {
    const { fragment } = setup();
    const data = createSourceObject({ bio: "a", friend: null });
    const tree = indexOperationFragmentTree(env, fragment, "User:1.embedded", {
      data,
    });
    expect(getNode(tree, "User:1.embedded").data).toBe(data);
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
    expect(fragmentTree.prev).toBe(base);
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
