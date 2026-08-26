import { gql } from "@apollo/client";
import { createParentLocator } from "../values";
import { ForestRun } from "../ForestRun";

// The malformed payload message is assembled by walking a tree that is, by definition, already
// broken. Traversal must never be the thing that surfaces: a throw here would replace a
// diagnosable invariant with an unrelated stack trace in telemetry.
jest.mock("../values", () => {
  const actual = jest.requireActual("../values");
  return {
    ...actual,
    createParentLocator: jest.fn(actual.createParentLocator),
  };
});

const participantFields = `
  __typename
  summary {
    __typename
    participants {
      __typename
      edges {
        __typename
        cursor
        node {
          __typename
          id
        }
      }
    }
  }
`;

const feedQuery = gql`
  query Feed {
    feed {
      __typename
      id
      lastMessage { id subject ${participantFields} }
      messages { id ${participantFields} }
    }
  }
`;

const seedQuery = gql`
  query Seed {
    message { id ${participantFields} }
  }
`;

const edge = (cursor: string) => ({
  __typename: "ParticipantEdge",
  cursor,
  node: { __typename: "User", id: cursor },
});

const message = (edges: unknown[]) => ({
  __typename: "Message",
  id: "message-1",
  summary: {
    __typename: "ThreadSummary",
    participants: { __typename: "ParticipantConnection", edges },
  },
});

test("degrades instead of throwing when path resolution fails", () => {
  (createParentLocator as jest.Mock).mockImplementation(() => () => {
    throw new Error("parent lookup exploded");
  });

  const warn = jest.fn();
  const cache = new ForestRun({
    typePolicies: { ParticipantEdge: { keyFields: ["cursor"] } },
    logger: { ...console, warn },
  });
  cache.write({
    query: seedQuery,
    result: { message: message([edge("a"), edge("b")]) },
  });

  const feed = {
    __typename: "Feed",
    id: "feed-1",
    lastMessage: {
      ...message([null, null, edge("a"), edge("b")]),
      subject: "subject",
    },
    messages: [message([])],
  };

  cache.write({ query: feedQuery, result: { feed } });

  // `resolveListItemChunk` no longer grows `itemChunks` past `data.length`, so the hole
  // is punched directly here: other writers (convert.ts, indexTree.ts, delete.ts) can
  // still produce one, so the reporting path stays worth covering.
  punchHole(cache);

  // Recycling is when the hole is finally dereferenced. It must not throw: rejecting
  // this write would reject every later one, since each recycle finds the hole again.
  expect(() =>
    cache.write({ query: feedQuery, result: { feed } }),
  ).not.toThrow();

  // The report still surfaces, degraded to what can be read off the damaged chunk, and
  // names the underlying failure rather than swallowing it.
  const reported = warn.mock.calls.flat().join("\n");
  expect(reported).toContain("malformed payload");
  expect(reported).toContain("reporting failed: parent lookup exploded");
});

test("reports a malformed list without rejecting later writes", () => {
  const warn = jest.fn();
  const cache = new ForestRun({
    typePolicies: { ParticipantEdge: { keyFields: ["cursor"] } },
    logger: { ...console, warn },
  });

  const feedWith = (edges: unknown[]) => ({
    __typename: "Feed",
    id: "feed-1",
    lastMessage: { ...message(edges), subject: "subject" },
    messages: [message(edges)],
  });

  const feed = feedWith([edge("a")]);
  cache.write({ query: feedQuery, result: { feed } });
  punchHole(cache);

  // Recycling the damaged chunk is when the hole is finally dereferenced. Throwing
  // here rejected this write *and every later one*, since each recycle found it again.
  expect(() =>
    cache.write({ query: feedQuery, result: { feed } }),
  ).not.toThrow();

  // The payload is reported instead.
  expect(warn.mock.calls.flat().join("\n")).toContain("malformed payload");

  for (const cursors of [["a", "b"], ["a", "b", "c"], ["d"]]) {
    expect(() =>
      cache.write({
        query: feedQuery,
        result: { feed: feedWith(cursors.map(edge)) },
      }),
    ).not.toThrow();
  }

  // ...and the operation keeps serving the data it was last written with.
  const diff = cache.diff({ query: feedQuery, optimistic: false });
  expect(
    (diff.result as any).feed.lastMessage.summary.participants.edges.map(
      (e: any) => e.cursor,
    ),
  ).toEqual(["d"]);
});

/** Leaves an unresolved item reference on every list chunk of the feed tree. */
function punchHole(cache: ForestRun) {
  const trees = [...(cache as any).store.dataForest.trees.values()];
  const tree: any = trees.find((t: any) => t.nodes.has("Feed:feed-1"));
  const seen = new Set<unknown>();
  const stack: any[] = [...tree.nodes.values()];
  let damaged = 0;
  while (stack.length) {
    const candidate = stack.pop();
    if (!candidate || typeof candidate !== "object" || seen.has(candidate)) {
      continue;
    }
    seen.add(candidate);
    const items = candidate.itemChunks;
    if (Array.isArray(candidate.data) && Array.isArray(items) && items.length) {
      // Index `items.length` is now a hole, index `items.length + 1` is not.
      items[items.length + 1] = items[0];
      damaged++;
      continue;
    }
    const values =
      candidate instanceof Map
        ? candidate.values()
        : Object.values(candidate as object);
    for (const value of values) {
      if (value && typeof value === "object") stack.push(value);
    }
  }
  expect(damaged).toBeGreaterThan(0);
}
