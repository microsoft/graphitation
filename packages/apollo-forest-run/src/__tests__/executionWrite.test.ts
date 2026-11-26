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

  it("writes an initial result like a regular result with missing deferred fields", () => {
    const cache = new ForestRun();
    const legacyCache = new ForestRun();
    cache.writeExecutionResult({
      query,
      execution: {
        data: initialData,
        pending: [{ id: "0", path: ["message"], label: "details" }],
        hasNext: true,
      },
    });
    legacyCache.write({ query, result: initialData });

    const diff = cache.diff({ query, optimistic: false });
    const legacyDiff = legacyCache.diff({ query, optimistic: false });

    expect(diff.result).toEqual(initialData);
    expect(diff).toEqual(legacyDiff);
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
  it.each([undefined, { data: initialData }])(
    "uses result even if legacy options contain execution: %p",
    (execution) => {
      const cache = new ForestRun();
      const options = { query, result: completeData, execution };
      cache.write(options);
      expect(cache.readQuery({ query })).toEqual(completeData);
    },
  );

  it("writes the result (Apollo Cache.WriteOptions)", () => {
    const cache = new ForestRun();
    const ref = cache.write({ query, result: completeData });

    expect(ref).toEqual({ __ref: "ROOT_QUERY" });
    expect(cache.diff({ query, optimistic: false })).toMatchObject({
      complete: true,
      result: completeData,
    });
  });
});
