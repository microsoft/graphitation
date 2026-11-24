import { parse } from "graphql";
import { executeWithSchema } from "../executeWithSchema";
import { isIncrementalExecutionResult } from "../executeWithoutSchema";

const definitions = parse(`
  type Query { message: Message, messages: [Message!]! }
  type Message { id: ID!, name: String }
`);
async function execute(query: string, enableEarlyExecution = false) {
  return executeWithSchema({
    definitions,
    document: parse(query),
    resolvers: {},
    rootValue: {
      message: { id: "1", name: "Alice" },
      messages: [
        { id: "1", name: "Alice" },
        { id: "2", name: "Bob" },
      ],
    },
    enableEarlyExecution,
  });
}

describe("pending deferred paths", () => {
  test.each([false, true])(
    "announces pending paths without changing patches (early=%s)",
    async (early) => {
      const result = await execute(
        `{ message { id ... @defer(label: "details") { name } } }`,
        early,
      );
      if (!isIncrementalExecutionResult(result))
        throw new Error("Expected incremental execution");
      expect(result.initialResult).toEqual({
        data: { message: { id: "1" } },
        pending: [{ path: ["message"], label: "details" }],
        hasNext: true,
      });
      const payloads = [];
      for await (const payload of result.subsequentResults)
        payloads.push(payload);
      expect(payloads).toEqual([
        {
          incremental: [
            { path: ["message"], label: "details", data: { name: "Alice" } },
          ],
          hasNext: false,
        },
      ]);
    },
  );

  test("registers synchronous root defers before building the response", async () => {
    const result = await execute(`{ ... @defer { message { id } } }`);
    if (!isIncrementalExecutionResult(result))
      throw new Error("Expected incremental execution");
    expect(result.initialResult.pending).toEqual([{ path: [] }]);
    expect(result.initialResult.data).toEqual({});
    expect(await result.subsequentResults.next()).toEqual({
      done: false,
      value: {
        incremental: [{ path: [], data: { message: { id: "1" } } }],
        hasNext: false,
      },
    });
  });

  test("uses response aliases and list positions", async () => {
    const result = await execute(`{
      items: messages { id ...Name @defer(label: "name") }
    } fragment Name on Message { name }`);
    if (!isIncrementalExecutionResult(result))
      throw new Error("Expected incremental execution");
    expect(result.initialResult.pending).toEqual([
      { path: ["items", 0], label: "name" },
      { path: ["items", 1], label: "name" },
    ]);
    await result.subsequentResults.return();
  });

  test.each(["@defer(if: false)", "@defer @skip(if: true)"])(
    "does not announce work that was not deferred: %s",
    async (directives) => {
      const result = await execute(
        `{ message { id ... ${directives} { name } } }`,
      );
      expect(isIncrementalExecutionResult(result)).toBe(false);
    },
  );
});
