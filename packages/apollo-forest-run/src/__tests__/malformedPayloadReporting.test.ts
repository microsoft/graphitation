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

  const cache = new ForestRun({
    typePolicies: { ParticipantEdge: { keyFields: ["cursor"] } },
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

  let error: Error | undefined;
  try {
    // The second write recycles the chunk corrupted by the first one, which is when the hole
    // left behind by the divergent lengths is finally dereferenced.
    cache.write({ query: feedQuery, result: { feed } });
    cache.write({ query: feedQuery, result: { feed } });
  } catch (e) {
    error = e as Error;
  }

  expect(error?.message).toContain("malformed payload");
  expect(error?.message).not.toContain("parent lookup exploded");
});
