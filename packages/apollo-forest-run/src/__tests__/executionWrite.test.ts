import { ForestRun } from "../ForestRun";
import { gql } from "./helpers/descriptor";

const query = gql`
  query {
    message {
      __typename
      id
      text
      ... @defer(label: "details") {
        details
      }
    }
  }
`;

const initialData = {
  message: { __typename: "Message", id: "1", text: "Hello" },
};
const completeData = {
  message: { ...initialData.message, details: "World" },
};

describe("writeExecutionResult", () => {
  it("writes a complete result", () => {
    const cache = new ForestRun();
    const ref = cache.writeExecutionResult({
      query,
      execution: { data: completeData },
    });
    const diff = cache.diff({ query, optimistic: false });

    expect(ref).toEqual({ __ref: "ROOT_QUERY" });
    expect(diff).toMatchObject({ complete: true, result: completeData });
  });

  it("returns the root reference for an initial result without writing to the forest", () => {
    const cache = new ForestRun();
    const ref = cache.writeExecutionResult({
      query,
      execution: {
        data: initialData,
        hasNext: true,
      },
    });
    expect(ref).toEqual({ __ref: "ROOT_QUERY" });
    expect(cache.extract()).toEqual({});
    expect(cache.readQuery({ query })).toBeNull();
  });

  it("returns the root reference like write", () => {
    const cache = new ForestRun();
    const legacyCache = new ForestRun();
    const ref = cache.writeExecutionResult({
      query,
      execution: { data: completeData },
    });
    const legacyRef = legacyCache.write({ query, result: completeData });

    expect(ref).toEqual(legacyRef);
    expect(cache.extract()).toEqual(legacyCache.extract());
  });

  it("writes subsequent results only via writeExecutionResult", () => {
    const cache = new ForestRun();
    cache.writeExecutionResult({
      query,
      execution: { data: initialData, hasNext: true },
    });
    const ref = cache.writeExecutionResult({
      query,
      execution: {
        incremental: [{ path: ["message"], data: { details: "World" } }],
        hasNext: false,
      },
    });

    expect(ref).toBeUndefined();
    expect(cache.diff({ query, optimistic: false })).toMatchObject({
      complete: true,
      result: completeData,
    });
    // @ts-expect-error write accepts results only (Apollo Cache.WriteOptions)
    cache.write({ query, execution: { incremental: [], hasNext: false } });
  });
});

describe("write", () => {
  it("writes the result (Apollo Cache.WriteOptions)", () => {
    const cache = new ForestRun();
    const ref = cache.write({ query, result: completeData });

    expect(ref).toEqual({ __ref: "ROOT_QUERY" });
    expect(cache.diff({ query, optimistic: false })).toMatchObject({
      complete: true,
      result: completeData,
    });
  });

  it.each([undefined, null])(
    "writes the result with execution: %s",
    (execution) => {
      const cache = new ForestRun();
      // Untyped options (not Cache.WriteOptions)
      const options = { query, result: completeData, execution };
      const ref = cache.write(options);

      expect(ref).toEqual({ __ref: "ROOT_QUERY" });
      expect(cache.diff({ query, optimistic: false })).toMatchObject({
        complete: true,
        result: completeData,
      });
    },
  );
});
