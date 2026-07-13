import { replaceValue, updateObject } from "../updateObject";
import { UpdateTreeContext } from "../types";
import { ForestRun } from "../../ForestRun";
import { gql, createTestOperation } from "../../__tests__/helpers/descriptor";
import { generateChunk } from "../../__tests__/helpers/values";
import { resolveFieldValue } from "../../values/resolve";
import { ObjectChunk } from "../../values/types";
import * as Difference from "../../diff/difference";

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
});

describe("divergent composite chunks", () => {
  it("keeps a null field when a composite list difference reaches it", () => {
    const base = generateChunk(`
      query Ring0CompositeList {
        emailsInfo @mock(value: null) {
          address
        }
      }
    `).value;
    const listDifference = Difference.createCompositeListDifference();
    listDifference.layout = [];
    const difference = Difference.createObjectDifference();
    Difference.addFieldDifference(difference, "emailsInfo", listDifference);
    Difference.addDirtyField(difference, "emailsInfo");

    const warn = jest.fn();
    const context = {
      operation: base.operation,
      drafts: new Map(),
      missingFields: new Map(),
      changes: new Map(),
      findParent: () => undefined,
      env: {
        objectKey: () => false,
        logger: {
          debug: jest.fn(),
          log: jest.fn(),
          warn,
          error: jest.fn(),
        },
      },
    } as unknown as UpdateTreeContext;

    let result: ReturnType<typeof updateObject>;
    expect(() => {
      result = updateObject(context, base, difference);
    }).not.toThrow();

    expect(result).toBeUndefined();
    expect(base.data.emailsInfo).toBeNull();
    expect(warn).toHaveBeenCalledWith(
      'Skipping update for "query Ring0CompositeList" at path emailsInfo: ' +
        "field is an explicit null (CompositeNull) in this chunk, but the incoming " +
        "CompositeListDifference expects a composite list; the node has divergent " +
        "chunks for this field (null in one, list in another). Leaving the null value " +
        "unchanged. This usually means the same node was written with conflicting " +
        "values in a single operation (e.g. aliased selections or a repeated node id) " +
        "or via a partial/errored write; ensure such selections resolve this field " +
        "consistently.",
    );
  });
});
