import { parse } from "graphql";
import { executeWithSchema } from "../executeWithSchema";
import { ExecutionResult, UserResolvers } from "../types";
import { isAsyncIterable, forAwaitEach } from "iterall";

/**
 * Tests for the deterministic, availability-driven `@defer` behaviour.
 *
 * A `@defer` fragment is included inline in the initial response only when every
 * field it selects reports - via its `isAvailable` probe - that it can be
 * produced from a local store right now. If any field lacks a probe or reports
 * unavailable, the whole fragment is streamed as a subsequent incremental
 * payload (matching graphql-js streaming behaviour).
 */

const schema = `
  type Query {
    person: Person
  }

  type Person {
    name: String
    gender: String
    birthYear: String
    bestFriend: Person
  }

  type Mutation {
    touch: Person
  }
`;

interface DrainedIncremental {
  initialResult: unknown;
  subsequentResults: unknown[];
}

interface PlainResult {
  data?: Record<string, unknown> | null;
  errors?: Array<{ message: string }>;
}

async function drain(
  result: ExecutionResult,
): Promise<ExecutionResult | DrainedIncremental> {
  if (isAsyncIterable(result)) {
    throw new Error("Unexpected async iterable result");
  }
  if ("subsequentResults" in result) {
    const subsequentResults: unknown[] = [];
    await forAwaitEach(
      result.subsequentResults as AsyncGenerator<unknown, void, void>,
      (item) => {
        subsequentResults.push(item);
      },
    );
    return { initialResult: result.initialResult, subsequentResults };
  }
  return result;
}

async function run(
  document: string,
  resolvers: UserResolvers<unknown, unknown>,
  contextValue: unknown = {},
) {
  const result = await executeWithSchema({
    definitions: parse(schema),
    document: parse(document),
    resolvers,
    contextValue,
  });
  return drain(result as ExecutionResult);
}

function isInlineResult(
  result: ExecutionResult | DrainedIncremental,
): result is ExecutionResult {
  return !("subsequentResults" in result);
}

describe("deterministic @defer - inlining when available", () => {
  const document = `
    {
      person {
        name
        ... on Person @defer {
          gender
          birthYear
        }
      }
    }
  `;

  test("inlines the fragment when every field is available", async () => {
    const resolvers: UserResolvers<unknown, unknown> = {
      Query: {
        person: () => ({}),
      },
      Person: {
        name: { resolve: () => "Luke" },
        gender: { resolve: () => "male", isAvailable: () => true },
        birthYear: { resolve: () => "19BBY", isAvailable: () => true },
      },
    };

    const result = await run(document, resolvers);

    expect(result).toEqual({
      data: { person: { name: "Luke", gender: "male", birthYear: "19BBY" } },
    });
  });

  test("inlines even when resolvers are asynchronous (DataLoader-style)", async () => {
    const resolvers: UserResolvers<unknown, unknown> = {
      Query: {
        person: () => ({}),
      },
      Person: {
        name: { resolve: () => "Luke" },
        gender: {
          resolve: async () => "male",
          isAvailable: () => true,
        },
        birthYear: {
          resolve: async () => "19BBY",
          isAvailable: async () => true,
        },
      },
    };

    const result = await run(document, resolvers);

    expect(result).toEqual({
      data: { person: { name: "Luke", gender: "male", birthYear: "19BBY" } },
    });
  });
});

describe("deterministic @defer - streaming when not available", () => {
  const document = `
    {
      person {
        name
        ... on Person @defer {
          gender
          birthYear
        }
      }
    }
  `;

  test("streams when a field reports not available", async () => {
    const resolvers: UserResolvers<unknown, unknown> = {
      Query: {
        person: () => ({}),
      },
      Person: {
        name: { resolve: () => "Luke" },
        gender: { resolve: () => "male", isAvailable: () => true },
        birthYear: { resolve: () => "19BBY", isAvailable: () => false },
      },
    };

    const result = await run(document, resolvers);

    expect(isInlineResult(result)).toBe(false);
    const incremental = result as DrainedIncremental;
    expect(incremental.initialResult).toEqual({
      data: { person: { name: "Luke" } },
      hasNext: true,
    });
    expect(incremental.subsequentResults).toEqual([
      {
        incremental: [
          { data: { gender: "male", birthYear: "19BBY" }, path: ["person"] },
        ],
        hasNext: false,
      },
    ]);
  });

  test("streams when any field lacks an isAvailable probe", async () => {
    const resolvers: UserResolvers<unknown, unknown> = {
      Query: {
        person: () => ({}),
      },
      Person: {
        name: { resolve: () => "Luke" },
        // gender has a probe, birthYear does not -> whole fragment streams
        gender: { resolve: () => "male", isAvailable: () => true },
        birthYear: { resolve: () => "19BBY" },
      },
    };

    const result = await run(document, resolvers);

    expect(isInlineResult(result)).toBe(false);
    const incremental = result as DrainedIncremental;
    expect(incremental.initialResult).toEqual({
      data: { person: { name: "Luke" } },
      hasNext: true,
    });
    expect(incremental.subsequentResults).toEqual([
      {
        incremental: [
          { data: { gender: "male", birthYear: "19BBY" }, path: ["person"] },
        ],
        hasNext: false,
      },
    ]);
  });

  test("streams when an async probe resolves to false", async () => {
    const resolvers: UserResolvers<unknown, unknown> = {
      Query: {
        person: () => ({}),
      },
      Person: {
        name: { resolve: () => "Luke" },
        gender: {
          resolve: () => "male",
          isAvailable: async () => false,
        },
        birthYear: {
          resolve: () => "19BBY",
          isAvailable: async () => true,
        },
      },
    };

    const result = await run(document, resolvers);

    expect(isInlineResult(result)).toBe(false);
    const incremental = result as DrainedIncremental;
    expect(incremental.initialResult).toEqual({
      data: { person: { name: "Luke" } },
      hasNext: true,
    });
  });

  test("streams when no probes exist at all (graphql-js default)", async () => {
    const resolvers: UserResolvers<unknown, unknown> = {
      Query: {
        person: () => ({}),
      },
      Person: {
        name: () => "Luke",
        gender: () => "male",
        birthYear: () => "19BBY",
      },
    };

    const result = await run(document, resolvers);

    expect(isInlineResult(result)).toBe(false);
  });

  test("streams an empty deferred fragment (no probeable fields)", async () => {
    const emptyDocument = `
      {
        person {
          name
          ... on Person @defer {
            gender @skip(if: true)
          }
        }
      }
    `;
    const resolvers: UserResolvers<unknown, unknown> = {
      Query: {
        person: () => ({}),
      },
      Person: {
        name: { resolve: () => "Luke" },
        gender: { resolve: () => "male", isAvailable: () => true },
      },
    };

    const result = await run(emptyDocument, resolvers);

    expect(isInlineResult(result)).toBe(false);
    const incremental = result as DrainedIncremental;
    expect(incremental.initialResult).toEqual({
      data: { person: { name: "Luke" } },
      hasNext: true,
    });
    expect(incremental.subsequentResults).toEqual([
      { incremental: [{ data: {}, path: ["person"] }], hasNext: false },
    ]);
  });
});

describe("deterministic @defer - probe receives resolver arguments", () => {
  test("probe is called with source, args and context", async () => {
    const probe = jest.fn().mockReturnValue(true);
    const document = `
      {
        person {
          name
          ... on Person @defer {
            gender
          }
        }
      }
    `;
    const resolvers: UserResolvers<unknown, unknown> = {
      Query: {
        person: () => ({ id: 7 }),
      },
      Person: {
        name: { resolve: () => "Luke" },
        gender: { resolve: () => "male", isAvailable: probe },
      },
    };

    const result = await run(document, resolvers, { token: "abc" });

    expect(result).toEqual({
      data: { person: { name: "Luke", gender: "male" } },
    });
    expect(probe).toHaveBeenCalledTimes(1);
    const [source, args, context] = probe.mock.calls[0];
    expect(source).toEqual({ id: 7 });
    expect(args).toEqual({});
    expect(context).toEqual({ token: "abc" });
  });
});

describe("deterministic @defer - deep merge of overlapping object subtrees", () => {
  test("merges a deferred object selection into the critical object selection", async () => {
    const document = `
      {
        person {
          bestFriend {
            name
          }
          ... on Person @defer {
            bestFriend {
              gender
            }
          }
        }
      }
    `;
    const resolvers: UserResolvers<unknown, unknown> = {
      Query: {
        person: () => ({}),
      },
      Person: {
        name: { resolve: () => "Luke" },
        gender: { resolve: () => "male" },
        bestFriend: {
          resolve: () => ({}),
          isAvailable: () => true,
        },
      },
    };

    const result = await run(document, resolvers);

    expect(result).toEqual({
      data: { person: { bestFriend: { name: "Luke", gender: "male" } } },
    });
  });
});

describe("deterministic @defer - errors in an inlined fragment", () => {
  test("promotes a nullable field error to the top level and keeps the fragment inline", async () => {
    const document = `
      {
        person {
          name
          ... on Person @defer {
            gender
          }
        }
      }
    `;
    const resolvers: UserResolvers<unknown, unknown> = {
      Query: {
        person: () => ({}),
      },
      Person: {
        name: { resolve: () => "Luke" },
        gender: {
          resolve: () => {
            throw new Error("boom");
          },
          isAvailable: () => true,
        },
      },
    };

    const result = await run(document, resolvers);

    expect(isInlineResult(result)).toBe(true);
    const inline = result as unknown as PlainResult;
    expect(inline.data).toEqual({ person: { name: "Luke", gender: null } });
    expect(inline.errors).toHaveLength(1);
    expect(inline.errors?.[0].message).toContain("boom");
  });
});

describe("deterministic @defer - nested defer", () => {
  test("inlines the outer fragment while streaming an unavailable nested fragment", async () => {
    const document = `
      {
        person {
          name
          ... on Person @defer {
            gender
            ... on Person @defer {
              birthYear
            }
          }
        }
      }
    `;
    const resolvers: UserResolvers<unknown, unknown> = {
      Query: {
        person: () => ({}),
      },
      Person: {
        name: { resolve: () => "Luke" },
        gender: { resolve: () => "male", isAvailable: () => true },
        birthYear: { resolve: () => "19BBY", isAvailable: () => false },
      },
    };

    const result = await run(document, resolvers);

    expect(isInlineResult(result)).toBe(false);
    const incremental = result as DrainedIncremental;
    // Outer fragment (gender) is inlined; nested fragment (birthYear) streams.
    expect(incremental.initialResult).toEqual({
      data: { person: { name: "Luke", gender: "male" } },
      hasNext: true,
    });
    expect(incremental.subsequentResults).toEqual([
      {
        incremental: [{ data: { birthYear: "19BBY" }, path: ["person"] }],
        hasNext: false,
      },
    ]);
  });
});

describe("deterministic @defer - mutations keep streaming", () => {
  test("a mutation @defer fragment streams even when available", async () => {
    const document = `
      mutation {
        touch {
          name
          ... on Person @defer {
            gender
          }
        }
      }
    `;
    const resolvers: UserResolvers<unknown, unknown> = {
      Mutation: {
        touch: () => ({}),
      },
      Person: {
        name: { resolve: () => "Luke" },
        gender: { resolve: () => "male", isAvailable: () => true },
      },
    };

    const result = await run(document, resolvers);

    expect(isInlineResult(result)).toBe(false);
    const incremental = result as DrainedIncremental;
    expect(incremental.initialResult).toEqual({
      data: { touch: { name: "Luke" } },
      hasNext: true,
    });
  });
});
