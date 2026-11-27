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
  it("writes a complete result like an ordinary write", () => {
    const cache = new ForestRun();
    const ordinary = new ForestRun();
    const ref = cache.writeExecutionResult({
      query,
      execution: { data: completeData },
    });
    const diff = cache.diff({ query, optimistic: false });

    expect(ref).toEqual(ordinary.write({ query, result: completeData }));
    expect(cache.extract()).toEqual(ordinary.extract());
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
