import { parse } from "graphql";
import { executeWithSchema } from "../executeWithSchema";

describe("executeWithSchema - @defer behavior", () => {
  function createDeferred<T>() {
    let resolve: (value: T) => void = () => {
      throw new Error("Deferred resolver is not initialized.");
    };
    const promise = new Promise<T>((innerResolve) => {
      resolve = innerResolve;
    });
    return { promise, resolve };
  }

  const definitions = parse(`
    type Query { messages: [Message!]! }
    type Message {
      id: String!
      name: String
    }
  `);

  const document = parse(`
    {
      messages {
        id
        ... on Message @defer {
          name
        }
      }
    }
  `);

  test("keeps synchronously completed deferred fields out of the initial response", async () => {
    const result = await Promise.resolve(
      executeWithSchema({
        document,
        definitions,
        enableEarlyExecution: true,
        resolvers: {
          Query: {
            messages: () => [{ id: "1", name: "Ada" }],
          },
        },
      }),
    );

    if (!("initialResult" in result)) {
      throw new Error("Expected an incremental result");
    }

    expect(result.initialResult).toEqual({
      data: { messages: [{ id: "1" }] },
      hasNext: true,
    });
    await expect(result.subsequentResults.next()).resolves.toEqual({
      value: {
        incremental: [
          {
            data: { name: "Ada" },
            path: ["messages", 0],
          },
        ],
        hasNext: false,
      },
      done: false,
    });
  });

  test("batches list patches that resolve in the same turn", async () => {
    const firstName = createDeferred<string>();
    const secondName = createDeferred<string>();
    const thirdName = createDeferred<string>();
    const result = await Promise.resolve(
      executeWithSchema({
        document,
        definitions,
        enableEarlyExecution: true,
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

    const subsequentResultPromise = result.subsequentResults.next();
    firstName.resolve("Ada");
    secondName.resolve("Grace");
    thirdName.resolve("Linus");

    await expect(subsequentResultPromise).resolves.toEqual({
      value: {
        incremental: [
          { data: { name: "Ada" }, path: ["messages", 0] },
          { data: { name: "Grace" }, path: ["messages", 1] },
          { data: { name: "Linus" }, path: ["messages", 2] },
        ],
        hasNext: false,
      },
      done: false,
    });
  });

  test("does not batch patches across task boundaries", async () => {
    const firstName = createDeferred<string>();
    const secondName = createDeferred<string>();
    const result = await Promise.resolve(
      executeWithSchema({
        document,
        definitions,
        enableEarlyExecution: true,
        resolvers: {
          Query: {
            messages: () => [
              { id: "1", name: firstName.promise },
              { id: "2", name: secondName.promise },
            ],
          },
        },
      }),
    );

    if (!("initialResult" in result)) {
      throw new Error("Expected an incremental result");
    }

    const firstResultPromise = result.subsequentResults.next();
    firstName.resolve("Ada");

    await expect(firstResultPromise).resolves.toEqual({
      value: {
        incremental: [{ data: { name: "Ada" }, path: ["messages", 0] }],
        hasNext: true,
      },
      done: false,
    });

    const secondResultPromise = result.subsequentResults.next();
    setTimeout(() => secondName.resolve("Grace"), 0);

    await expect(secondResultPromise).resolves.toEqual({
      value: {
        incremental: [{ data: { name: "Grace" }, path: ["messages", 1] }],
        hasNext: false,
      },
      done: false,
    });
  });
});
