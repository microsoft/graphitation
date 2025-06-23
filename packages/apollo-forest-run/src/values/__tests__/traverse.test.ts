import { generateChunk } from "../../__tests__/helpers/values";
import {
  createParentLocator,
  descendToChunk,
  ascendFromChunk,
  findClosestNode,
  getGraphValueReference,
  retrieveEmbeddedValue,
} from "../traverse";
import {
  ObjectChunk,
  CompositeListChunk,
  NodeValue,
  NodeChunk,
} from "../types";
import { resolveFieldValue, resolveListItemChunk } from "../resolve";

describe(findClosestNode, () => {
  it("returns the chunk itself when the chunk is a NodeChunk", () => {
    const query = `{ node { id } }`;
    const { value: root, dataMap } = generateChunk(query);
    const node = resolveFieldValue(root, "node") as ObjectChunk;

    const findParent = createParentLocator(dataMap);

    const nodeClosest = findClosestNode(node, findParent);
    const rootClosest = findClosestNode(root, findParent);

    expect(nodeClosest).toBe(node);
    expect(rootClosest).toBe(root);
  });

  it("returns the closest NodeChunk when the chunk is nested under an ObjectChunk", () => {
    const query = `{
      node {
        id
        child { foo }
      }
    }`;
    const { value: root, dataMap } = generateChunk(query);
    const node = resolveFieldValue(root, "node") as ObjectChunk;
    const child = resolveFieldValue(node, "child") as ObjectChunk;

    const findParent = createParentLocator(dataMap);

    const result = findClosestNode(child, findParent);
    expect(result).toBe(node);
  });

  it("returns the closest NodeChunk when the chunk is nested under a CompositeListChunk", () => {
    const query = `{
      node {
        id
        items @mock(count: 2) { foo }
      }
    }`;
    const { value: root, dataMap } = generateChunk(query);
    const node = resolveFieldValue(root, "node") as ObjectChunk;
    const items = resolveFieldValue(node, "items") as CompositeListChunk;
    const item0 = resolveListItemChunk(items, 0) as ObjectChunk;
    const item1 = resolveListItemChunk(items, 1) as ObjectChunk;

    const findParent = createParentLocator(dataMap);

    const node0 = findClosestNode(item0, findParent);
    const node1 = findClosestNode(item1, findParent);

    expect(node0).toBe(node);
    expect(node1).toBe(node);
  });

  it("returns the closest NodeChunk in a deeply nested structure", () => {
    const query = `{
      node {
        id
        child {
          items @mock(count: 1) {
            detail {
              foo
            }
          }
        }
      }
    }`;
    const { value: root, dataMap } = generateChunk(query);
    const node = resolveFieldValue(root, "node") as ObjectChunk;
    const child = resolveFieldValue(node, "child") as ObjectChunk;
    const items = resolveFieldValue(child, "items") as CompositeListChunk;
    const item = resolveListItemChunk(items, 0) as ObjectChunk;
    const detail = resolveFieldValue(item, "detail") as ObjectChunk;

    const findParent = createParentLocator(dataMap);

    const result = findClosestNode(detail, findParent);
    expect(result).toBe(node);
  });
});

describe(descendToChunk, () => {
  it("descends from root to a nested child chunk", () => {
    const query = `{
      parent {
        child {
          grandchild {
            id
          }
        }
      }
    }`;
    const { value: root, dataMap } = generateChunk(query);
    const findParent = createParentLocator(dataMap);

    const parent = resolveFieldValue(root, "parent") as ObjectChunk;
    const child = resolveFieldValue(parent, "child") as ObjectChunk;
    const grandchild = resolveFieldValue(child, "grandchild") as ObjectChunk;

    const env = { findParent };

    const visited: unknown[][] = [];
    const result = descendToChunk(
      env,
      root,
      grandchild,
      (value, parent, step) => {
        visited.push([value, parent, step]);
      },
    );

    expect(result).toBe(grandchild);
    expect(visited.length).toBe(3);

    expect(visited[0]?.[0]).toBe(parent);
    expect(visited[0]?.[1]).toBe(root);
    expect(visited[0]?.[2]).toBe(root.selection.fields.get("parent")?.[0]);

    expect(visited[1]?.[0]).toBe(child);
    expect(visited[1]?.[1]).toBe(parent);
    expect(visited[1]?.[2]).toBe(parent.selection.fields.get("child")?.[0]);

    expect(visited[2]?.[0]).toBe(grandchild);
    expect(visited[2]?.[1]).toBe(child);
    expect(visited[2]?.[2]).toBe(child.selection.fields.get("grandchild")?.[0]);
  });

  it("returns immediately when from and to are the same chunk", () => {
    const query = `{ foo }`;
    const { value: root, dataMap } = generateChunk(query);
    const findParent = createParentLocator(dataMap);

    const env = { findParent };

    const visited: unknown[][] = [];
    const result = descendToChunk(env, root, root, (value, parent, step) => {
      visited.push([value, parent, step]);
    });

    expect(result).toBe(undefined);
    expect(visited.length).toBe(0);
  });

  it("throws when from is not an ancestor of to", () => {
    const query = `{
      parent1 {
        child {
          id
        }
      }
      parent2 {
        child {
          id
        }
      }
    }`;
    const { value: root, dataMap } = generateChunk(query);
    const findParent = createParentLocator(dataMap);

    const parent1 = resolveFieldValue(root, "parent1") as ObjectChunk;
    const parent2 = resolveFieldValue(root, "parent2") as ObjectChunk;
    const child2 = resolveFieldValue(parent2, "child") as ObjectChunk;

    const env = { findParent };

    const visited: unknown[][] = [];
    const run = () => {
      descendToChunk(env, parent1, child2, (value, parent, step) => {
        visited.push([value, parent, step]);
      });
    };

    expect(run).toThrow("Invariant violation");
    expect(visited.length).toBe(0);
  });

  it("stops traversal when visit function returns false", () => {
    const query = `{
      parent {
        child {
          grandchild {
            id
          }
        }
      }
    }`;
    const { value: root, dataMap } = generateChunk(query);
    const findParent = createParentLocator(dataMap);

    const parent = resolveFieldValue(root, "parent") as ObjectChunk;
    const child = resolveFieldValue(parent, "child") as ObjectChunk;
    const grandchild = resolveFieldValue(child, "grandchild") as ObjectChunk;

    const env = { findParent };

    const visited: unknown[][] = [];
    const result = descendToChunk(
      env,
      root,
      grandchild,
      (value, parent, step) => {
        visited.push([value, parent, step]);
        if (typeof step === "object" && step.name === "child") {
          return false;
        }
      },
    );

    expect(result).toBe(child);
    expect(visited.length).toBe(2);

    expect(visited[0][0]).toBe(parent);
    expect(visited[0][1]).toBe(root);
    expect(visited[0][2]).toBe(root.selection.fields.get("parent")?.[0]);

    expect(visited[1][0]).toBe(child);
    expect(visited[1][1]).toBe(parent);
    expect(visited[1][2]).toBe(parent.selection.fields.get("child")?.[0]);
  });

  it("descends through a list to reach a list item", () => {
    const query = `{
      parent {
        items @mock(count: 2) {
          id
        }
      }
    }`;
    const { value: root, dataMap } = generateChunk(query);
    const findParent = createParentLocator(dataMap);

    const parent = resolveFieldValue(root, "parent") as ObjectChunk;
    const items = resolveFieldValue(parent, "items") as CompositeListChunk;
    const item1 = resolveListItemChunk(items, 1) as ObjectChunk;

    const env = { findParent };

    const visited: unknown[][] = [];
    const result = descendToChunk(env, root, item1, (value, parent, step) => {
      visited.push([value, parent, step]);
    });

    expect(result).toBe(item1);
    expect(visited.length).toBe(3);

    expect(visited[0][0]).toBe(parent);
    expect(visited[0][1]).toBe(root);
    expect(visited[0][2]).toBe(root.selection.fields.get("parent")?.[0]);

    expect(visited[1][0]).toBe(items);
    expect(visited[1][1]).toBe(parent);
    expect(visited[1][2]).toBe(parent.selection.fields.get("items")?.[0]);

    expect(visited[2][0]).toBe(item1);
    expect(visited[2][1]).toBe(items);
    expect(visited[2][2]).toBe(1);
  });

  it("descends by path of the chunk from another operation (having the same possibleSelections)", () => {
    // Note: mocks are set up in a way that the same query produces the same document / possibleSelections
    const query = `{
      parent {
        child { id }
      }
    }`;

    const { value: root1, dataMap: _ } = generateChunk(query);
    const { value: root2, dataMap: dataMap2 } = generateChunk(query);

    const findParent = createParentLocator(dataMap2);

    const parent1 = resolveFieldValue(root1, "parent") as ObjectChunk;
    const child1 = resolveFieldValue(parent1, "child") as ObjectChunk;

    const parent2 = resolveFieldValue(root2, "parent") as ObjectChunk;
    const child2 = resolveFieldValue(parent2, "child") as ObjectChunk;

    const env = { findParent };

    const visited: unknown[][] = [];
    const result = descendToChunk(env, root1, child2, (value, parent, step) => {
      visited.push([value, parent, step]);
    });

    expect(result).toBe(child1);
    expect(visited.length).toBe(2);

    expect(visited[0][0]).toBe(parent1);
    expect(visited[0][1]).toBe(root1);
    expect(visited[0][2]).toBe(root1.selection.fields.get("parent")?.[0]);

    expect(visited[1][0]).toBe(child1);
    expect(visited[1][1]).toBe(parent1);
    expect(visited[1][2]).toBe(parent1.selection.fields.get("child")?.[0]);
  });

  it("throws on missing parent references", () => {
    const query = `{
      child { id }
    }`;
    const { value: root } = generateChunk(query);
    const child = resolveFieldValue(root, "child") as ObjectChunk;

    const env = {
      findParent: () => {
        throw new Error("Parent not found");
      },
    };

    const visited: unknown[][] = [];
    const run = () =>
      descendToChunk(env, root, child, (value, parent, step) => {
        visited.push([value, parent, step]);
      });

    expect(run).toThrow("Parent not found");
    expect(visited.length).toBe(0); // No traversal due to missing parent references
  });

  it("descends correctly when multiple branches exist", () => {
    const query = `{
      parent1 { foo }
      parent2 {
        branch1 {
          foo
        }
        branch2 {
          target {
            foo
          }
        }
      }
    }`;
    const { value: root, dataMap } = generateChunk(query);

    const parent2 = resolveFieldValue(root, "parent2") as ObjectChunk;
    const branch2 = resolveFieldValue(parent2, "branch2") as ObjectChunk;
    const target = resolveFieldValue(branch2, "target") as ObjectChunk;

    const env = { findParent: createParentLocator(dataMap) };

    const visited: unknown[][] = [];
    const result = descendToChunk(env, root, target, (value, parent, step) => {
      visited.push([value, parent, step]);
    });

    expect(result).toBe(target);
    expect(visited.length).toBe(3);

    expect(visited[0][0]).toBe(parent2);
    expect(visited[0][1]).toBe(root);
    expect(visited[0][2]).toBe(root.selection.fields.get("parent2")?.[0]);

    expect(visited[1][0]).toBe(branch2);
    expect(visited[1][1]).toBe(parent2);
    expect(visited[1][2]).toBe(parent2.selection.fields.get("branch2")?.[0]);

    expect(visited[2][0]).toBe(target);
    expect(visited[2][1]).toBe(branch2);
    expect(visited[2][2]).toBe(branch2.selection.fields.get("target")?.[0]);
  });
});

describe(ascendFromChunk, () => {
  it("ascends from nested child chunk up to root", () => {
    const query = `{
      parent {
        child {
          grandchild {
            id
          }
        }
      }
    }`;
    const { value: root, dataMap } = generateChunk(query);
    const findParent = createParentLocator(dataMap);

    const parent = resolveFieldValue(root, "parent") as ObjectChunk;
    const child = resolveFieldValue(parent, "child") as ObjectChunk;
    const grandchild = resolveFieldValue(child, "grandchild") as ObjectChunk;

    const env = { findParent };

    const visited: unknown[][] = [];
    const result = ascendFromChunk(env, grandchild, (value, parent, step) => {
      visited.push([value, parent, step]);
    });

    expect(result).toBe(root);
    expect(visited.length).toBe(3);

    expect(visited[0]?.[0]).toBe(grandchild);
    expect(visited[0]?.[1]).toBe(child);
    expect(visited[0]?.[2]).toBe(child.selection.fields.get("grandchild")?.[0]);

    expect(visited[1]?.[0]).toBe(child);
    expect(visited[1]?.[1]).toBe(parent);
    expect(visited[1]?.[2]).toBe(parent.selection.fields.get("child")?.[0]);

    expect(visited[2]?.[0]).toBe(parent);
    expect(visited[2]?.[1]).toBe(root);
    expect(visited[2]?.[2]).toBe(root.selection.fields.get("parent")?.[0]);
  });

  it("returns immediately on root chunk", () => {
    const query = `{ foo }`;
    const { value: root, dataMap } = generateChunk(query);
    const findParent = createParentLocator(dataMap);

    const env = { findParent };

    const visited: unknown[][] = [];
    const result = ascendFromChunk(env, root, (value, parent, step) => {
      visited.push([value, parent, step]);
    });

    expect(result).toBe(root);
    expect(visited.length).toBe(0);
  });

  it("stops traversal when visit function returns false", () => {
    const query = `{
      parent {
        child {
          grandchild {
            id
          }
        }
      }
    }`;
    const { value: root, dataMap } = generateChunk(query);
    const findParent = createParentLocator(dataMap);

    const parent = resolveFieldValue(root, "parent") as ObjectChunk;
    const child = resolveFieldValue(parent, "child") as ObjectChunk;
    const grandchild = resolveFieldValue(child, "grandchild") as ObjectChunk;

    const env = { findParent };

    const visited: unknown[][] = [];
    const result = ascendFromChunk(env, grandchild, (value, parent, step) => {
      visited.push([value, parent, step]);
      if (typeof step === "object" && step.name === "child") {
        return false;
      }
    });

    expect(result).toBe(child);
    expect(visited.length).toBe(2);

    expect(visited[0][0]).toBe(grandchild);
    expect(visited[0][1]).toBe(child);
    expect(visited[0][2]).toBe(child.selection.fields.get("grandchild")?.[0]);

    expect(visited[1][0]).toBe(child);
    expect(visited[1][1]).toBe(parent);
    expect(visited[1][2]).toBe(parent.selection.fields.get("child")?.[0]);
  });

  it("ascends through a list", () => {
    const query = `{
      parent {
        items @mock(count: 2) {
          id
        }
      }
    }`;
    const { value: root, dataMap } = generateChunk(query);
    const findParent = createParentLocator(dataMap);

    const parent = resolveFieldValue(root, "parent") as ObjectChunk;
    const items = resolveFieldValue(parent, "items") as CompositeListChunk;
    const item1 = resolveListItemChunk(items, 1) as ObjectChunk;

    const env = { findParent };

    const visited: unknown[][] = [];
    const result = ascendFromChunk(env, item1, (value, parent, step) => {
      visited.push([value, parent, step]);
    });

    expect(result).toBe(root);
    expect(visited.length).toBe(3);

    expect(visited[0][0]).toBe(item1);
    expect(visited[0][1]).toBe(items);
    expect(visited[0][2]).toBe(1);

    expect(visited[1][0]).toBe(items);
    expect(visited[1][1]).toBe(parent);
    expect(visited[1][2]).toBe(parent.selection.fields.get("items")?.[0]);

    expect(visited[2][0]).toBe(parent);
    expect(visited[2][1]).toBe(root);
    expect(visited[2][2]).toBe(root.selection.fields.get("parent")?.[0]);
  });
});

describe(retrieveEmbeddedValue, () => {
  it("retrieves the self node value", () => {
    const query = `{ node { id @mock(value: "key") } }`;
    const { value: root, dataMap } = generateChunk(query);
    const node = resolveFieldValue(root, "node") as NodeValue;

    const env = { findParent: createParentLocator(dataMap) };

    const result = retrieveEmbeddedValue(env, node, "key");

    expect(result).toBe(node);
  });

  it("throws on mismatching node key", () => {
    const query = `{ node { id @mock(value: "key") } }`;
    const { value: root, dataMap } = generateChunk(query);
    const node = resolveFieldValue(root, "node") as NodeValue;

    const env = { findParent: createParentLocator(dataMap) };

    const run = () => retrieveEmbeddedValue(env, node, "badKey");

    expect(run).toThrow("Invariant violation");
  });

  it("retrieves the same logical value across different operations", () => {
    const query1 = `{
      node {
        id
        child {
          name
        }
      }
    }`;

    const query2 = `{
      node {
        id
        child {
          name
          age
        }
      }
    }`;
    const { value: root1, dataMap: dataMap1 } = generateChunk(query1);
    const { value: root2, dataMap: dataMap2 } = generateChunk(query2);
    const env1 = { findParent: createParentLocator(dataMap1) };
    const env2 = { findParent: createParentLocator(dataMap2) };

    const node1 = resolveFieldValue(root1, "node") as NodeChunk;
    const child1 = resolveFieldValue(node1, "child") as ObjectChunk;

    const node2 = resolveFieldValue(root2, "node") as NodeChunk;
    const child2 = resolveFieldValue(node2, "child");

    // Build the reference to the 'child' field in the first operation
    // and use it to retrieve the same value from the second operation
    const childRef = getGraphValueReference(env1, child1);
    const result = retrieveEmbeddedValue(env2, node2, childRef);

    // The retrieved value should be the 'child' value from the second operation
    expect(result).toBe(child2);
  });

  it("retrieves a list item across different operations", () => {
    const query1 = `{
      node {
        id
        items @mock(count: 2) {
          value
        }
      }
    }`;
    const query2 = `{
      node {
        id
        items @mock(count: 2) {
          value
          extraField
        }
      }
    }`;
    const { value: root1, dataMap: dataMap1 } = generateChunk(query1);
    const { value: root2, dataMap: dataMap2 } = generateChunk(query2);
    const env1 = { findParent: createParentLocator(dataMap1) };
    const env2 = { findParent: createParentLocator(dataMap2) };

    const node1 = resolveFieldValue(root1, "node") as NodeChunk;
    const items1 = resolveFieldValue(node1, "items") as CompositeListChunk;
    const item1 = resolveListItemChunk(items1, 1) as ObjectChunk;

    const node2 = resolveFieldValue(root2, "node") as NodeChunk;
    const items2 = resolveFieldValue(node2, "items") as CompositeListChunk;
    const item2 = resolveListItemChunk(items2, 1) as ObjectChunk;

    // Build the reference to the list item and use it to get the same item from another operation
    const itemRef = getGraphValueReference(env1, item1);
    const result = retrieveEmbeddedValue(env2, node2, itemRef);

    expect(result).toBe(item2);
  });

  it("retrieves a deeply nested value across different operations", () => {
    const query1 = `{
      node {
        id
        child {
          items @mock(count: 1) {
            detail {
              name
            }
          }
        }
      }
    }`;
    const query2 = `{
      node {
        id
        child {
          items @mock(count: 1) {
            detail {
              name
              description
            }
          }
        }
      }
    }`;
    const { value: root1, dataMap: dataMap1 } = generateChunk(query1);
    const { value: root2, dataMap: dataMap2 } = generateChunk(query2);
    const env1 = { findParent: createParentLocator(dataMap1) };
    const env2 = { findParent: createParentLocator(dataMap2) };

    const node1 = resolveFieldValue(root1, "node") as NodeChunk;
    const child1 = resolveFieldValue(node1, "child") as ObjectChunk;
    const items1 = resolveFieldValue(child1, "items") as CompositeListChunk;
    const item1 = resolveListItemChunk(items1, 0) as ObjectChunk;
    const detail1 = resolveFieldValue(item1, "detail") as ObjectChunk;

    const node2 = resolveFieldValue(root2, "node") as NodeChunk;
    const child2 = resolveFieldValue(node2, "child") as ObjectChunk;
    const items2 = resolveFieldValue(child2, "items") as CompositeListChunk;
    const item2 = resolveListItemChunk(items2, 0) as ObjectChunk;
    const detail2 = resolveFieldValue(item2, "detail") as ObjectChunk;

    // Obtain the reference to 'detail' from the first operation and use it to fetch the same value from the second operation
    const detailRef = getGraphValueReference(env1, detail1);
    const result = retrieveEmbeddedValue(env2, node2, detailRef);

    expect(result).toBe(detail2);
  });

  it("returns undefined when ref points outside of the source in different operations", () => {
    const query1 = `{
      node {
        id
        child { foo }
      }
    }`;
    const query2 = `{
      node { id }
    }`;
    const { value: root1, dataMap: dataMap1 } = generateChunk(query1);
    const { value: root2, dataMap: dataMap2 } = generateChunk(query2);
    const env1 = { findParent: createParentLocator(dataMap1) };
    const env2 = { findParent: createParentLocator(dataMap2) };

    const node1 = resolveFieldValue(root1, "node") as NodeChunk;
    const child1 = resolveFieldValue(node1, "child") as ObjectChunk;

    const node2 = resolveFieldValue(root2, "node") as NodeChunk;

    const childRef = getGraphValueReference(env1, child1);
    const result = retrieveEmbeddedValue(env2, node2, childRef);

    expect(result).toBeUndefined();
  });
});
