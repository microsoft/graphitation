import { parse } from "graphql";
import { executeWithSchema } from "../executeWithSchema";

describe("executeWithSchema - @defer behavior", () => {
  function createDeferred<T>() {
    let resolve: (value: T) => void;
    const promise = new Promise<T>((innerResolve) => {
      resolve = innerResolve;
    });
    return { promise, resolve: resolve! };
  }

  const definitions = parse(`
    type Query { obj: Obj }
    type Obj {
      critical: String
      deferred: String
    }
  `);

  const document = parse(`
    {
      obj {
        critical
        ... on Obj @defer {
          deferred
        }
      }
    }
  `);

  type Resolver = () => string | Promise<string>;

  function executeTestQuery(
    Obj: { critical: Resolver; deferred: Resolver },
    incrementalPayloadBatchingTimeoutMs?: number,
  ) {
    return Promise.resolve(
      executeWithSchema({
        document,
        definitions,
        enableEarlyExecution: true,
        enableDeferredMerge: true,
        incrementalPayloadBatchingTimeoutMs,
        resolvers: {
          Query: {
            obj: () => ({}),
          },
          Obj,
        },
      }),
    );
  }

  const topLevelDeferDefinitions = parse(`
    type Query {
      critical: String
      deferred: String
    }
  `);

  const topLevelDeferDocument = parse(`
    {
      critical
      ... @defer {
        deferred
      }
    }
  `);

  test("emits top-level deferred patches when early execution is disabled and initial fields are synchronous", async () => {
    const deferred = createDeferred<string>();

    const result = await Promise.resolve(
      executeWithSchema({
        document: topLevelDeferDocument,
        definitions: topLevelDeferDefinitions,
        resolvers: {
          Query: {
            critical: () => "critical",
            deferred: () => deferred.promise,
          },
        },
      }),
    );

    expect(result).toMatchObject({
      initialResult: {
        data: {
          critical: "critical",
        },
        hasNext: true,
      },
    });

    if (!("initialResult" in result)) {
      throw new Error("Expected an incremental result");
    }

    const subsequentResultPromise = result.subsequentResults.next();
    deferred.resolve("deferred");

    await expect(subsequentResultPromise).resolves.toMatchObject({
      value: {
        incremental: [
          {
            data: {
              deferred: "deferred",
            },
          },
        ],
        hasNext: false,
      },
      done: false,
    });
  });

  test("includes deferred fields in the initial response when they complete within the merge timeout", async () => {
    const result = await executeTestQuery(
      {
        critical: () => "critical",
        deferred: () =>
          new Promise<string>((resolve) => setTimeout(resolve, 0, "deferred")),
      },
      10,
    );

    expect(result).toEqual({
      data: {
        obj: {
          critical: "critical",
          deferred: "deferred",
        },
      },
    });
    expect("initialResult" in (result as object)).toBe(false);
  });

  test("folds a synchronous deferred field into the initial response instead of streaming it", async () => {
    const result = await executeTestQuery({
      critical: () => "critical",
      deferred: () => "deferred",
    });

    // Both fields resolve synchronously, so the deferred fragment is already
    // complete by the time the response is built. The optimization folds it
    // into the initial data rather than emitting a redundant incremental
    // payload, producing a single (non-incremental) result.
    expect(result).toEqual({
      data: {
        obj: {
          critical: "critical",
          deferred: "deferred",
        },
      },
    });
    expect("initialResult" in (result as object)).toBe(false);
  });

  const twoDeferDefinitions = parse(`
    type Query { obj: Obj }
    type Obj {
      critical: String
      deferredEarly: String
      deferredLate: String
    }
  `);

  const twoDeferDocument = parse(`
    {
      obj {
        critical
        ... on Obj @defer(label: "early") {
          deferredEarly
        }
        ... on Obj @defer(label: "late") {
          deferredLate
        }
      }
    }
  `);

  function executeTwoDeferQuery(Obj: {
    critical: Resolver;
    deferredEarly: Resolver;
    deferredLate: Resolver;
  }) {
    return Promise.resolve(
      executeWithSchema({
        document: twoDeferDocument,
        definitions: twoDeferDefinitions,
        enableEarlyExecution: true,
        enableDeferredMerge: true,
        resolvers: {
          Query: {
            obj: () => ({}),
          },
          Obj,
        },
      }),
    );
  }

  test("folds the deferred fragment that settled before critical and streams the one that settled after", async () => {
    const critical = createDeferred<string>();
    const late = createDeferred<string>();

    const resultPromise = executeTwoDeferQuery({
      // Resolves synchronously, so this fragment completes before critical.
      deferredEarly: () => "early",
      // Stays pending past the initial response, so this fragment streams.
      deferredLate: () => late.promise,
      critical: () => critical.promise,
    });

    setTimeout(() => critical.resolve("critical"), 0);

    const result = await resultPromise;

    // The early fragment is folded into the initial response; the late one is
    // still pending, so the overall result is incremental.
    expect(result).toMatchObject({
      initialResult: {
        data: {
          obj: {
            critical: "critical",
            deferredEarly: "early",
          },
        },
        hasNext: true,
      },
    });

    if (!("initialResult" in result)) {
      throw new Error("Expected an incremental result");
    }

    expect(result.initialResult.data).toEqual({
      obj: { critical: "critical", deferredEarly: "early" },
    });

    const subsequentResultPromise = result.subsequentResults.next();
    late.resolve("late");

    await expect(subsequentResultPromise).resolves.toMatchObject({
      value: {
        incremental: [
          {
            data: {
              deferredLate: "late",
            },
            path: ["obj"],
          },
        ],
        hasNext: false,
      },
      done: false,
    });
  });

  // Schema where the critical field is non-null: when it errors, the null
  // bubbles up and destroys the whole `obj` branch the deferred fragment is
  // anchored to.
  const nonNullCriticalDefinitions = parse(`
    type Query { obj: Obj }
    type Obj {
      critical: String!
      deferred: String
    }
  `);

  function executeNonNullCriticalQuery(Obj: {
    critical: Resolver;
    deferred: Resolver;
  }) {
    return Promise.resolve(
      executeWithSchema({
        document,
        definitions: nonNullCriticalDefinitions,
        resolvers: {
          Query: {
            obj: () => ({}),
          },
          Obj,
        },
      }),
    );
  }

  test("does not fold a synchronously-completed deferred fragment when a non-null sibling error nulls its parent", async () => {
    const result = await executeNonNullCriticalQuery({
      critical: () => {
        throw new Error("Critical boom");
      },
      deferred: () => "deferred",
    });

    // The non-null `critical` error bubbles up and nulls `obj`. The deferred
    // fragment completed synchronously, but its anchor object is gone, so it
    // must not be folded into the (now null) branch.
    expect(result).toMatchObject({
      data: {
        obj: null,
      },
    });
    expect("initialResult" in (result as object)).toBe(false);
    const errors = (result as { errors?: ReadonlyArray<{ message: string }> })
      .errors;
    expect(errors).toHaveLength(1);
    expect(errors?.[0].message).toBe("Critical boom");
  });

  const messageListDefinitions = parse(`
    type Query { messages: [Message!]! }
    type Message {
      id: String!
      name: String
    }
  `);

  const messageListDocument = parse(`
    {
      messages {
        id
        ... on Message @defer {
          name
        }
      }
    }
  `);

  test("batches deferred patches that complete within the batching timeout", async () => {
    const firstName = createDeferred<string>();
    const secondName = createDeferred<string>();
    const thirdName = createDeferred<string>();

    const result = await Promise.resolve(
      executeWithSchema({
        document: messageListDocument,
        definitions: messageListDefinitions,
        enableEarlyExecution: true,
        enableDeferredMerge: true,
        incrementalPayloadBatchingTimeoutMs: 10,
        resolvers: {
          Query: {
            messages: () => [
              { id: "1", name: firstName.promise },
              { id: "2", name: secondName.promise },
              { id: "3", name: thirdName.promise },
            ],
          },
        },
      }),
    );

    expect(result).toMatchObject({
      initialResult: {
        data: {
          messages: [{ id: "1" }, { id: "2" }, { id: "3" }],
        },
        hasNext: true,
      },
    });

    if (!("initialResult" in result)) {
      throw new Error("Expected an incremental result");
    }

    const subsequentResultPromise = result.subsequentResults.next();
    firstName.resolve("Ada");
    setTimeout(() => secondName.resolve("Grace"), 0);
    setTimeout(() => thirdName.resolve("Linus"), 0);

    await expect(subsequentResultPromise).resolves.toMatchObject({
      value: {
        incremental: [
          {
            data: {
              name: "Ada",
            },
            path: ["messages", 0],
          },
          {
            data: {
              name: "Grace",
            },
            path: ["messages", 1],
          },
          {
            data: {
              name: "Linus",
            },
            path: ["messages", 2],
          },
        ],
        hasNext: false,
      },
      done: false,
    });
  });

  test("emits deferred patches individually without additional waiting by default", async () => {
    const firstName = createDeferred<string>();
    const secondName = createDeferred<string>();
    const thirdName = createDeferred<string>();

    const resultPromise = Promise.resolve(
      executeWithSchema({
        document: messageListDocument,
        definitions: messageListDefinitions,
        enableEarlyExecution: true,
        enableDeferredMerge: true,
        resolvers: {
          Query: {
            messages: () => [
              { id: "1", name: firstName.promise },
              { id: "2", name: secondName.promise },
              { id: "3", name: thirdName.promise },
            ],
          },
        },
      }),
    );

    const result = await Promise.race([
      resultPromise,
      new Promise<"blocked">((resolve) => setTimeout(resolve, 0, "blocked")),
    ]);

    if (result === "blocked") {
      throw new Error("Initial response waited without batching enabled");
    }

    if (!("initialResult" in result)) {
      throw new Error("Expected an incremental result");
    }

    const firstSubsequentResultPromise = result.subsequentResults.next();
    firstName.resolve("Ada");

    await expect(firstSubsequentResultPromise).resolves.toMatchObject({
      value: {
        incremental: [
          {
            data: {
              name: "Ada",
            },
            path: ["messages", 0],
          },
        ],
        hasNext: true,
      },
      done: false,
    });

    const secondSubsequentResultPromise = result.subsequentResults.next();
    secondName.resolve("Grace");

    await expect(secondSubsequentResultPromise).resolves.toMatchObject({
      value: {
        incremental: [
          {
            data: {
              name: "Grace",
            },
            path: ["messages", 1],
          },
        ],
        hasNext: true,
      },
      done: false,
    });

    const thirdSubsequentResultPromise = result.subsequentResults.next();
    thirdName.resolve("Linus");

    await expect(thirdSubsequentResultPromise).resolves.toMatchObject({
      value: {
        incremental: [
          {
            data: {
              name: "Linus",
            },
            path: ["messages", 2],
          },
        ],
        hasNext: false,
      },
      done: false,
    });
  });
});
