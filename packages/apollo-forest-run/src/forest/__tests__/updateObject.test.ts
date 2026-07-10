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

const NESTED_INCOMPATIBLE_NULL_DIFF_ERROR =
  'Invariant violation: Failed to update "query BaseFeedQuery" ' +
  "at path listContainer.items.0.value (in Entity): expected CompositeNull, got ObjectDifference";

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

  it("reports the full path when the failing value is a nested CompositeNull", () => {
    const cache = new ForestRun();

    // Same setup as above, but here the same Entity's "value" is a null (with a
    // sub-selection, i.e. a CompositeNull) under "listContainer" and an object under
    // "objectContainer". A CompositeNull's source data is `null`, so it is not
    // addressable by the path utils on its own - the reported path must therefore be
    // derived from its parent chunk, yielding the full "listContainer.items.0.value"
    // rather than just the final "value" segment.
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

    let error: unknown;
    try {
      run();
    } catch (thrown) {
      error = thrown;
    }

    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).toBe(NESTED_INCOMPATIBLE_NULL_DIFF_ERROR);
  });
});
