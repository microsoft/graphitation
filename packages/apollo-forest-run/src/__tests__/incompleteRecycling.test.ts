import { gql } from "@apollo/client";
import { ForestRun } from "../ForestRun";

// `incompleteChunks` is per-tree state, rebuilt every time a tree is indexed. Recycling
// re-uses chunks of a previous tree wholesale, so a chunk that is still missing fields
// has to re-register itself. When it did not, the incompleteness silently disappeared
// the first time a write recycled the tree, and later reads served the placeholder
// objects that indexing had substituted for holes as if they were real data.

const participantFields = `
  __typename
  summary {
    __typename
    participants {
      __typename
      edges {
        __typename
        cursor
        node { __typename id }
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

const messageQuery = gql`
  query MessageById {
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

const feed = (lastMessageEdges: unknown[], messageEdges: unknown[]) => ({
  feed: {
    __typename: "Feed",
    id: "feed-1",
    lastMessage: { ...message(lastMessageEdges), subject: "subject" },
    messages: [message(messageEdges)],
  },
});

function newCache() {
  return new ForestRun({
    typePolicies: { ParticipantEdge: { keyFields: ["cursor"] } },
  });
}

const cursorsOf = (result: unknown) =>
  (result as any)?.feed?.messages?.[0]?.summary?.participants?.edges?.map(
    (e: any) => e?.cursor,
  );

describe("incompleteness across recycling", () => {
  it("does not serve placeholder objects after a divergent chunk is recycled", () => {
    const cache = newCache();

    // A single malformed payload: the same node appears twice with different list
    // lengths, so the shorter chunk ends up padded with placeholders when the longer
    // one dictates the layout.
    cache.write({
      query: feedQuery,
      result: feed([edge("a"), edge("b"), edge("c"), edge("d")], []),
    });

    // Grow, then shrink the same node through another operation. The second write
    // recycles the tree produced by the first.
    cache.write({
      query: messageQuery,
      result: {
        message: message([
          edge("a"),
          edge("b"),
          edge("c"),
          edge("d"),
          edge("e"),
        ]),
      },
    });
    cache.write({
      query: messageQuery,
      result: { message: message([edge("a"), edge("b"), edge("c")]) },
    });

    const diff = cache.diff({ query: feedQuery, optimistic: false });

    // Before the fix this returned `[{}, {}, {}]` — three objects with no fields at
    // all — while still reporting `complete: true`.
    expect(cursorsOf(diff.result)).toEqual(["a", "b", "c"]);
  });
});
