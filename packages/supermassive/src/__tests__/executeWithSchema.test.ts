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

  const nestedDefinitions = parse(`
    type Query { obj: Obj }
    type Obj {
      critical: String
      nested: Nested
    }
    type Nested {
      deferred: String
    }
  `);

  const nestedDocument = parse(`
    {
      obj {
        critical
        ... on Obj @defer {
          nested {
            deferred
          }
        }
      }
    }
  `);

  const mutationDefinitions = parse(`
    type Query { noop: String }
    type Mutation {
      critical: String
      deferred: String
    }
  `);

  const mutationDocument = parse(`
    mutation {
      critical
      ... on Mutation @defer {
        deferred
      }
    }
  `);

  type Resolver = () => string | Promise<string>;

  function executeTestQuery(Obj: { critical: Resolver; deferred: Resolver }) {
    return Promise.resolve(
      executeWithSchema({
        document,
        definitions,
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

  function executeNestedTestQuery(Obj: {
    critical: Resolver;
    deferred: Resolver;
  }) {
    return Promise.resolve(
      executeWithSchema({
        document: nestedDocument,
        definitions: nestedDefinitions,
        enableEarlyExecution: true,
        enableDeferredMerge: true,
        resolvers: {
          Query: {
            obj: () => ({}),
          },
          Obj: {
            critical: Obj.critical,
            nested: () => ({}),
          },
          Nested: {
            deferred: Obj.deferred,
          },
        },
      }),
    );
  }

  function executeTestMutation(Mutation: {
    critical: Resolver;
    deferred: Resolver;
  }) {
    return Promise.resolve(
      executeWithSchema({
        document: mutationDocument,
        definitions: mutationDefinitions,
        enableEarlyExecution: true,
        enableDeferredMerge: true,
        resolvers: {
          Mutation,
        },
      }),
    );
  }

  test("returns the initial response without waiting for deferred fields beyond the merge tick", async () => {
    const critical = createDeferred<string>();
    const deferred = createDeferred<string>();

    const resultPromise = executeTestQuery({
      critical: () => critical.promise,
      deferred: () => deferred.promise,
    });

    critical.resolve("critical");
    const result = await resultPromise;

    expect(result).toMatchObject({
      initialResult: {
        data: {
          obj: {
            critical: "critical",
          },
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
            path: ["obj"],
          },
        ],
        hasNext: false,
      },
      done: false,
    });
  });

  test("includes deferred fields in the initial response when they complete on the merge tick", async () => {
    const result = await executeTestQuery({
      critical: () => "critical",
      deferred: () =>
        new Promise<string>((resolve) => setTimeout(resolve, 0, "deferred")),
    });

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

  test("includes deferred fields in the initial response when they complete before the critical fields", async () => {
    const critical = createDeferred<string>();

    const resultPromise = executeTestQuery({
      deferred: () => Promise.resolve("deferred"),
      critical: () => critical.promise,
    });

    setTimeout(() => critical.resolve("critical"), 0);

    await expect(resultPromise).resolves.toEqual({
      data: {
        obj: {
          critical: "critical",
          deferred: "deferred",
        },
      },
    });
  });

  test("surfaces deferred errors at the top level when piggybacked onto the initial response", async () => {
    const critical = createDeferred<string>();

    const resultPromise = executeTestQuery({
      deferred: () => {
        throw new Error("Deferred boom");
      },
      critical: () => critical.promise,
    });

    setTimeout(() => critical.resolve("critical"), 0);

    const result = await resultPromise;

    expect(result).toMatchObject({
      data: {
        obj: {
          critical: "critical",
          deferred: null,
        },
      },
    });
    expect("initialResult" in (result as object)).toBe(false);
    expect(
      (result as { errors?: ReadonlyArray<{ message: string }> }).errors,
    ).toHaveLength(1);
    expect(
      (result as { errors: ReadonlyArray<{ message: string }> }).errors[0]
        .message,
    ).toBe("Deferred boom");
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

  test("delivers a synchronously-completed deferred field incrementally when merge is disabled", async () => {
    // Early execution starts the deferred fragment eagerly, but with merge
    // disabled it is never folded into the initial response (mirroring
    // graphql-js's `enableEarlyExecution`): it is always delivered as a
    // separate incremental payload.
    const result = await executeWithSchema({
      document,
      definitions,
      enableEarlyExecution: true,
      enableDeferredMerge: false,
      resolvers: {
        Query: {
          obj: () => ({}),
        },
        Obj: {
          critical: () => "critical",
          deferred: () => "deferred",
        },
      },
    });

    expect(result).toMatchObject({
      initialResult: {
        data: {
          obj: {
            critical: "critical",
          },
        },
        hasNext: true,
      },
    });

    if (!("initialResult" in result)) {
      throw new Error("Expected an incremental result");
    }

    expect(result.initialResult.data).toEqual({
      obj: { critical: "critical" },
    });

    await expect(result.subsequentResults.next()).resolves.toMatchObject({
      value: {
        incremental: [
          {
            data: {
              deferred: "deferred",
            },
            path: ["obj"],
          },
        ],
        hasNext: false,
      },
      done: false,
    });
  });

  test("keeps legacy defer behavior when early execution is disabled", async () => {
    const result = await executeWithSchema({
      document,
      definitions,
      enableEarlyExecution: false,
      enableDeferredMerge: false,
      resolvers: {
        Query: {
          obj: () => ({}),
        },
        Obj: {
          critical: () => "critical",
          deferred: () => "deferred",
        },
      },
    });

    expect(result).toMatchObject({
      initialResult: {
        data: {
          obj: {
            critical: "critical",
          },
        },
        hasNext: true,
      },
    });

    if (!("initialResult" in result)) {
      throw new Error("Expected an incremental result");
    }

    await expect(result.subsequentResults.next()).resolves.toMatchObject({
      value: {
        incremental: [
          {
            data: {
              deferred: "deferred",
            },
            path: ["obj"],
          },
        ],
        hasNext: false,
      },
      done: false,
    });
  });

  test("includes nested deferred field in the initial response when it settles before critical", async () => {
    const critical = createDeferred<string>();

    const resultPromise = executeNestedTestQuery({
      deferred: () => Promise.resolve("deferred"),
      critical: () => critical.promise,
    });

    setTimeout(() => critical.resolve("critical"), 0);

    await expect(resultPromise).resolves.toEqual({
      data: {
        obj: {
          critical: "critical",
          nested: {
            deferred: "deferred",
          },
        },
      },
    });
  });

  test("streams nested deferred field when critical fields are ready first", async () => {
    const deferred = createDeferred<string>();

    const result = await executeNestedTestQuery({
      critical: () => "critical",
      deferred: () => deferred.promise,
    });

    expect(result).toMatchObject({
      initialResult: {
        data: {
          obj: {
            critical: "critical",
          },
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
              nested: {
                deferred: "deferred",
              },
            },
            path: ["obj"],
          },
        ],
        hasNext: false,
      },
      done: false,
    });
  });

  test("includes deferred mutation fields in the initial response when they settle before critical", async () => {
    const critical = createDeferred<string>();

    const resultPromise = executeTestMutation({
      critical: () => critical.promise,
      deferred: () => Promise.resolve("deferred"),
    });

    setTimeout(() => critical.resolve("critical"), 0);

    await expect(resultPromise).resolves.toEqual({
      data: {
        critical: "critical",
        deferred: "deferred",
      },
    });
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

  const ifDocument = parse(`
    query ($shouldDefer: Boolean!) {
      obj {
        critical
        ... on Obj @defer(if: $shouldDefer) {
          deferred
        }
      }
    }
  `);

  function executeIfTestQuery(
    Obj: { critical: Resolver; deferred: Resolver },
    shouldDefer: boolean,
  ) {
    return Promise.resolve(
      executeWithSchema({
        document: ifDocument,
        definitions,
        enableEarlyExecution: true,
        enableDeferredMerge: true,
        variableValues: { shouldDefer },
        resolvers: {
          Query: {
            obj: () => ({}),
          },
          Obj,
        },
      }),
    );
  }

  test("streams the deferred field when @defer(if: true) and critical is ready first", async () => {
    const deferred = createDeferred<string>();

    const result = await executeIfTestQuery(
      {
        critical: () => "critical",
        deferred: () => deferred.promise,
      },
      true,
    );

    expect(result).toMatchObject({
      initialResult: {
        data: {
          obj: {
            critical: "critical",
          },
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
            path: ["obj"],
          },
        ],
        hasNext: false,
      },
      done: false,
    });
  });

  test("does not defer the field when @defer(if: false), even if it is slow", async () => {
    const deferred = createDeferred<string>();

    const resultPromise = executeIfTestQuery(
      {
        critical: () => "critical",
        deferred: () => deferred.promise,
      },
      false,
    );

    // With `if: false` the fragment is not deferred, so the field is critical
    // and the response must wait for it instead of streaming it.
    const raced = await Promise.race([
      resultPromise,
      new Promise<"pending">((resolve) => setTimeout(resolve, 0, "pending")),
    ]);

    expect(raced).toBe("pending");

    deferred.resolve("deferred");

    await expect(resultPromise).resolves.toEqual({
      data: {
        obj: {
          critical: "critical",
          deferred: "deferred",
        },
      },
    });
  });

  test("returns a single non-incremental result when @defer(if: false)", async () => {
    const result = await executeIfTestQuery(
      {
        critical: () => "critical",
        deferred: () => "deferred",
      },
      false,
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

  test("batches deferred patches that complete in the same microtask queue", async () => {
    const firstName = createDeferred<string>();
    const secondName = createDeferred<string>();
    const thirdName = createDeferred<string>();

    const result = await Promise.resolve(
      executeWithSchema({
        document: messageListDocument,
        definitions: messageListDefinitions,
        enableEarlyExecution: true,
        enableDeferredMerge: true,
        enableIncrementalPayloadBatching: true,
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
    secondName.resolve("Grace");
    thirdName.resolve("Linus");

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

  test("emits deferred patches individually by default", async () => {
    const firstName = createDeferred<string>();
    const secondName = createDeferred<string>();
    const thirdName = createDeferred<string>();

    const result = await Promise.resolve(
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
