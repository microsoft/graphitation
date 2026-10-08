import { gql } from "@apollo/client";
import { ForestRun } from "../ForestRun";

const parentFragment = gql`
  fragment ParentFields on Parent {
    id
    details @include(if: $includeDetails) {
      count
    }
    group {
      entries {
        ... on Entry {
          children {
            id
            metadata {
              value
            }
          }
        }
      }
    }
  }
`;

const preloaderQuery = gql`
  query PreloaderQuery(
    $coveredOperations: [String!]
    $includeDetails: Boolean = false
  ) @cache(covers: $coveredOperations) {
    other {
      id
    }
    parents {
      nodes {
        ...ParentFields
      }
    }
  }
  ${parentFragment}
`;

const parentListQuery = gql`
  query ParentListQuery($includeDetails: Boolean = false) {
    parents {
      nodes {
        ...ParentFields
      }
    }
  }
  ${parentFragment}
`;

function createParentsResult(value: string | null) {
  return {
    __typename: "ParentConnection",
    nodes: ["parent-1", "parent-2"].map((id) => ({
      __typename: "Parent",
      id,
      group: {
        __typename: "Group",
        entries: [
          {
            __typename: "Entry",
            children: [
              {
                __typename: "Child",
                id: "0",
                metadata:
                  value === null
                    ? null
                    : {
                        __typename: "Metadata",
                        value,
                      },
              },
            ],
          },
        ],
      },
    })),
  };
}

describe("repeated children with chunk reconciliation disabled", () => {
  test.each([{ coversEnabled: false }, { coversEnabled: true }])(
    "updates metadata without throwing (coversEnabled=$coversEnabled)",
    ({ coversEnabled }) => {
      const cache = new ForestRun({ reconcileDivergentChunks: false });
      const variables = {
        coveredOperations: coversEnabled ? ["ParentListQuery"] : null,
        includeDetails: true,
      };
      const writePreloader = (value: string | null) => {
        const parents = createParentsResult(value);
        cache.writeQuery({
          query: preloaderQuery,
          variables,
          data: {
            other: { __typename: "Other", id: "other-1" },
            parents: {
              ...parents,
              nodes: parents.nodes.map((parent) => ({
                ...parent,
                details: {
                  __typename: "Details",
                  count: 0,
                },
              })),
            },
          },
        });
      };

      // Every payload has distinct, consistent occurrences of Child:0.
      // No network payload or cache read result is mutated.
      writePreloader(null);

      // The different includeDetails values prevent recycling whole parents.
      // With covers enabled, both child occurrences are candidates for recycling.
      expect(
        cache.diff({ query: parentListQuery, optimistic: true }),
      ).toMatchObject({
        complete: true,
        result: { parents: createParentsResult(null) },
      });

      writePreloader("initial-value");
      expect(
        cache.diff({ query: parentListQuery, optimistic: true }),
      ).toMatchObject({
        complete: true,
        result: { parents: createParentsResult("initial-value") },
      });

      // A missed occurrence above would make this object diff encounter stale null.
      expect(() => writePreloader("updated-value")).not.toThrow();

      expect(
        cache.diff({ query: parentListQuery, optimistic: true }),
      ).toMatchObject({
        complete: true,
        result: { parents: createParentsResult("updated-value") },
      });
    },
  );
});

describe("manual writes sharing composite references", () => {
  const childFragment = gql`
    fragment ChildValue on Child {
      id
      value
    }
  `;
  const aliasedQuery = gql`
    query AliasedChildren {
      first: child(id: "1") {
        ...ChildValue
      }
      second: child(id: "1") {
        ...ChildValue
      }
      unrelated: child(id: "2") {
        ...ChildValue
      }
    }
    ${childFragment}
  `;

  test("does not copy distinct objects with the same normalized id", () => {
    const cache = new ForestRun();
    const first = { __typename: "Child", id: "1", value: "initial" };
    const data = {
      first,
      second: { ...first },
      unrelated: { __typename: "Child", id: "2", value: "unchanged" },
    };
    cache.writeQuery({ query: aliasedQuery, data });
    expect(cache.readQuery({ query: aliasedQuery })).toBe(data);
  });

  test.each(["writeFragment", "modify"] as const)(
    "%s updates every occurrence without mutating frozen input",
    (method) => {
      const cache = new ForestRun();
      const shared = Object.freeze({
        __typename: "Child",
        id: "1",
        value: "initial",
      });
      const unrelated = Object.freeze({
        __typename: "Child",
        id: "2",
        value: "unchanged",
      });
      const data = Object.freeze({
        first: shared,
        second: shared,
        unrelated,
      });

      cache.writeQuery({ query: aliasedQuery, data });
      const before = cache.readQuery<typeof data>({ query: aliasedQuery });
      expect(before).toEqual(data);
      expect(before?.first).toBe(shared);
      expect(before?.second).not.toBe(shared);
      expect(before?.unrelated).toBe(unrelated);

      if (method === "writeFragment") {
        cache.writeFragment({
          id: "Child:1",
          fragment: childFragment,
          data: { ...shared, value: "updated" },
        });
      } else {
        cache.modify({
          id: "Child:1",
          fields: { value: () => "updated" },
        });
      }

      const after = cache.readQuery<typeof data>({ query: aliasedQuery });
      expect(after).toEqual({
        first: { ...shared, value: "updated" },
        second: { ...shared, value: "updated" },
        unrelated,
      });
      expect(after?.unrelated).toBe(unrelated);
      expect(before).toEqual(data);
      expect(shared.value).toBe("initial");
    },
  );

  test.each(["child", "list"] as const)(
    "updates descendants in shared %s occurrences, including duplicate list slots",
    (sharedKind) => {
      const cache = new ForestRun();
      const query = gql`
        query NestedChildren {
          parents {
            id
            children {
              ...ChildValue
            }
          }
        }
        ${childFragment}
      `;
      const child = Object.freeze({
        __typename: "Child",
        id: "1",
        value: "initial",
      });
      const sharedList = Object.freeze([child, child]);
      const data = Object.freeze({
        parents: Object.freeze(
          ["parent-1", "parent-2"].map((id) =>
            Object.freeze({
              __typename: "Parent",
              id,
              children:
                sharedKind === "list"
                  ? sharedList
                  : Object.freeze([...sharedList]),
            }),
          ),
        ),
      });

      cache.writeQuery({ query, data });
      for (const value of ["first-update", "second-update"]) {
        cache.writeFragment({
          id: "Child:1",
          fragment: childFragment,
          data: { ...child, value },
        });
        expect(cache.readQuery({ query })).toEqual({
          parents: data.parents.map((parent) => ({
            ...parent,
            children: [
              { ...child, value },
              { ...child, value },
            ],
          })),
        });
      }
      expect(child.value).toBe("initial");
      expect(data.parents[0].children[0]).toBe(child);
      expect(data.parents[1].children[1]).toBe(child);
    },
  );

  test("preserves identity assigned by a fragment write when cloning a keyless payload", () => {
    const cache = new ForestRun();
    const fragment = gql`
      fragment ChildWithoutId on Child {
        value
      }
    `;
    const query = gql`
      query ChildrenWithoutId {
        first {
          ...ChildWithoutId
        }
        second {
          ...ChildWithoutId
        }
      }
      ${fragment}
    `;
    const child = { __typename: "Child", value: "initial" };
    cache.writeFragment({ id: "Child:1", fragment, data: child });
    cache.writeQuery({ query, data: { first: child, second: child } });
    cache.writeFragment({
      id: "Child:1",
      fragment,
      data: { ...child, value: "updated" },
    });

    expect(cache.readQuery({ query })).toEqual({
      first: { ...child, value: "updated" },
      second: { ...child, value: "updated" },
    });
  });

  test("preserves alias selections and does not clone object-valued scalars", () => {
    const cache = new ForestRun();
    const query = gql`
      query DifferentSelections {
        first: child {
          id
          value
          metadata {
            value
          }
        }
        second: child {
          id
          extra
          metadata {
            value
          }
        }
        opaque
      }
    `;
    const metadata = Object.freeze({
      __typename: "Metadata",
      value: "initial",
    });
    const child = Object.freeze({
      __typename: "Child",
      id: "1",
      value: "initial",
      extra: "initial",
      metadata,
    });
    const data = { first: child, second: child, opaque: metadata };
    cache.writeQuery({ query, data });
    cache.writeFragment({
      id: "Child:1",
      fragment: gql`
        fragment ChildDetails on Child {
          value
          extra
          metadata {
            value
          }
        }
      `,
      data: {
        ...child,
        value: "updated",
        extra: "updated",
        metadata: { ...metadata, value: "updated" },
      },
    });

    const result = cache.readQuery<typeof data>({ query });
    expect(result).toMatchObject({
      first: { value: "updated", metadata: { value: "updated" } },
      second: { extra: "updated", metadata: { value: "updated" } },
    });
    expect(result?.opaque).toBe(metadata);
    expect(child.metadata.value).toBe("initial");
  });

  test("repairs shared references created by a list update without losing missing fields", () => {
    const cache = new ForestRun();
    const query = gql`
      query IncompleteChildren {
        children {
          id
          value
          metadata {
            value
          }
        }
      }
    `;
    const child = { __typename: "Child", id: "1", value: "initial" };
    cache.writeQuery({ query, data: { children: [child] } });
    cache.modify({
      fields: {
        children: (existing) => [...existing, ...existing],
      },
    });

    expect(cache.diff({ query, optimistic: true })).toMatchObject({
      complete: false,
      result: { children: [child, child] },
    });
    cache.writeFragment({
      id: "Child:1",
      fragment: childFragment,
      data: { ...child, value: "updated" },
    });
    expect(cache.diff({ query, optimistic: true })).toMatchObject({
      complete: false,
      result: {
        children: [
          { ...child, value: "updated" },
          { ...child, value: "updated" },
        ],
      },
    });
  });

  test("updates and rolls back every shared occurrence in an optimistic layer", () => {
    const cache = new ForestRun();
    const child = { __typename: "Child", id: "1", value: "initial" };
    const data = {
      first: child,
      second: child,
      unrelated: { __typename: "Child", id: "2", value: "unchanged" },
    };
    cache.writeQuery({ query: aliasedQuery, data });
    cache.recordOptimisticTransaction((optimisticCache) => {
      optimisticCache.writeFragment({
        id: "Child:1",
        fragment: childFragment,
        data: { ...child, value: "optimistic" },
      });
    }, "shared-child");

    expect(cache.readQuery({ query: aliasedQuery, optimistic: true })).toEqual({
      ...data,
      first: { ...child, value: "optimistic" },
      second: { ...child, value: "optimistic" },
    });
    expect(cache.readQuery({ query: aliasedQuery, optimistic: false })).toEqual(
      data,
    );
    cache.removeOptimistic("shared-child");
    expect(cache.readQuery({ query: aliasedQuery, optimistic: true })).toEqual(
      data,
    );
  });

  test("preserves missing and deleted fields across all repaired occurrences", () => {
    const cache = new ForestRun();
    const query = gql`
      query PartialChildren {
        children {
          id
          value
          metadata {
            value
          }
        }
      }
    `;
    const child = { __typename: "Child", id: "1", value: "initial" };
    cache.writeQuery({ query, data: { children: [child, child] } });
    expect(cache.diff({ query, optimistic: true })).toMatchObject({
      complete: false,
      result: { children: [child, child] },
    });

    cache.writeFragment({
      id: "Child:1",
      fragment: gql`
        fragment ChildMetadata on Child {
          metadata {
            value
          }
        }
      `,
      data: {
        __typename: "Child",
        metadata: { __typename: "Metadata", value: "present" },
      },
    });
    expect(cache.diff({ query, optimistic: true }).complete).toBe(true);
    cache.evict({ id: "Child:1", fieldName: "metadata" });
    expect(cache.diff({ query, optimistic: true })).toMatchObject({
      complete: false,
      result: { children: [child, child] },
    });
  });
});
