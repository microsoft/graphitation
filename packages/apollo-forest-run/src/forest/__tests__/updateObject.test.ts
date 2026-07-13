import { replaceValue } from "../updateObject";
import { UpdateTreeContext } from "../types";
import { ForestRun } from "../../ForestRun";
import { gql, createTestOperation } from "../../__tests__/helpers/descriptor";
import { generateChunk } from "../../__tests__/helpers/values";
import { resolveFieldValue } from "../../values/resolve";
import { ObjectChunk } from "../../values/types";

describe("replaceValue invariant", () => {
  it("reports the operation when a scalar is replaced with an object", () => {
    const operation = createTestOperation(gql`
      query ReplaceScalar {
        name
      }
    `);
    const scalarBase = resolveFieldValue(
      generateChunk(`query ScalarSource { name }`).value,
      "name",
    );
    const objectReplacement = resolveFieldValue(
      generateChunk(
        `query ObjectSource { node { __typename @mock(value: "Widget") id } }`,
      ).value,
      "node",
    ) as ObjectChunk;

    const context = {
      operation,
      findParent: () => undefined,
    } as unknown as UpdateTreeContext;

    expect(() =>
      replaceValue(context, scalarBase as any, objectReplacement),
    ).toThrow(
      'Invariant violation: Failed to update "query ReplaceScalar": cannot replace Scalar with Object (of type Widget)',
    );
  });

  it("still reports the invariant when path/node resolution throws", () => {
    const operation = createTestOperation(gql`
      query ReplaceObject {
        node {
          id
        }
      }
    `);
    // base is an addressable, keyless embedded object, so both path resolution and
    // enclosing-node resolution must ascend the tree via findParent. A corrupt tree can
    // make findParent throw while an invariant is being reported; the message builder must
    // swallow that and still surface the invariant rather than the internal exception.
    const objectBase = resolveFieldValue(
      generateChunk(`query ObjectSource { embedded { field } }`).value,
      "embedded",
    ) as ObjectChunk;
    const listReplacement = resolveFieldValue(
      generateChunk(`query ListSource { items @mock(count: 2) { id } }`).value,
      "items",
    );

    const context = {
      operation,
      findParent: () => {
        throw new Error("corrupt tree: findParent exploded");
      },
    } as unknown as UpdateTreeContext;

    expect(() =>
      replaceValue(context, objectBase as any, listReplacement as any),
    ).toThrow(
      'Invariant violation: Failed to update "query ReplaceObject": cannot replace Object with CompositeList',
    );
  });
});

const nestedFeedListQuery = gql`
  query BaseFeedQuery {
    objectContainer {
      __typename
      id
      items {
        __typename
        id
        value {
          note
        }
      }
    }
    listContainer {
      __typename
      id
      items {
        __typename
        id
        value {
          note
        }
      }
    }
  }
`;
const nestedFeedObjectQuery = gql`
  query ModelFeedQuery {
    objectContainer {
      __typename
      id
      items {
        __typename
        id
        value {
          note
        }
      }
    }
  }
`;

const NESTED_INCOMPATIBLE_OBJECT_DIFF_ERROR =
  'Invariant violation: Failed to update "query BaseFeedQuery" ' +
  "at path listContainer.items.0.value (in Entity): expected CompositeList, got ObjectDifference";

const NESTED_DIVERGENT_NULL_WARNING_PATH =
  "at path listContainer.items.0.value (in Entity)";

describe("incompatible object difference invariant", () => {
  it("reports operation and path for a field two levels deep below a list", () => {
    const cache = new ForestRun();

    // The same Entity ("Entity:1") is reached through two different containers within
    // a single tree: under "objectContainer" its "value" is an object, while under
    // "listContainer" the same field is a list. This leaves the normalized entity with
    // inconsistent structural representations of "value".
    cache.write({
      query: nestedFeedListQuery,
      result: {
        objectContainer: {
          __typename: "Container",
          id: "object",
          items: [{ __typename: "Entity", id: "1", value: { note: "old" } }],
        },
        listContainer: {
          __typename: "Container",
          id: "list",
          items: [{ __typename: "Entity", id: "1", value: [{ note: "old" }] }],
        },
      },
    });

    const run = () =>
      cache.write({
        query: nestedFeedObjectQuery,
        result: {
          objectContainer: {
            __typename: "Container",
            id: "object",
            items: [{ __typename: "Entity", id: "1", value: { note: "new" } }],
          },
        },
      });

    let error: unknown;
    try {
      run();
    } catch (thrown) {
      error = thrown;
    }

    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).toBe(
      NESTED_INCOMPATIBLE_OBJECT_DIFF_ERROR,
    );
  });

  it("reports the full path in the divergent-null warning without throwing", () => {
    // A divergent null/object chunk no longer throws: the null chunk is skipped with a
    // warning. That warning must still report the full path, even though a CompositeNull's
    // source data is `null` and is not addressable by the path utils on its own - the path
    // is derived from its parent chunk, yielding "listContainer.items.0.value".
    const warnings: string[] = [];
    const cache = new ForestRun({
      logger: {
        ...console,
        warn: (...args: unknown[]) => warnings.push(args.join(" ")),
      },
    });

    // The same Entity's "value" is a null (with a sub-selection, i.e. a CompositeNull)
    // under "listContainer" and an object under "objectContainer".
    cache.write({
      query: nestedFeedListQuery,
      result: {
        objectContainer: {
          __typename: "Container",
          id: "object",
          items: [{ __typename: "Entity", id: "1", value: { note: "old" } }],
        },
        listContainer: {
          __typename: "Container",
          id: "list",
          items: [{ __typename: "Entity", id: "1", value: null }],
        },
      },
    });

    const run = () =>
      cache.write({
        query: nestedFeedObjectQuery,
        result: {
          objectContainer: {
            __typename: "Container",
            id: "object",
            items: [{ __typename: "Entity", id: "1", value: { note: "new" } }],
          },
        },
      });

    expect(run).not.toThrow();
    expect(
      warnings.some((w) => w.includes(NESTED_DIVERGENT_NULL_WARNING_PATH)),
    ).toBe(true);
  });
});
