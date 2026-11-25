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

describe("write with options.execution", () => {
  it("writes a complete result", () => {
    const cache = new ForestRun();
    const ref = cache.write({ query, execution: { data: completeData } });
    const diff = cache.diff({ query, optimistic: false });

    expect(ref).toEqual({ __ref: "ROOT_QUERY" });
    expect(diff).toMatchObject({ complete: true, result: completeData });
  });

  it("writes an initial result like a regular result with missing deferred fields", () => {
    const cache = new ForestRun();
    const legacyCache = new ForestRun();
    cache.write({
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

  it("prefers execution over the deprecated result", () => {
    const cache = new ForestRun();
    cache.write({
      query,
      result: initialData,
      execution: { data: completeData },
    });

    expect(cache.diff({ query, optimistic: false }).result).toEqual(
      completeData,
    );
  });

  it("still writes the deprecated result", () => {
    const cache = new ForestRun();
    cache.write({ query, result: completeData });

    expect(cache.diff({ query, optimistic: false })).toMatchObject({
      complete: true,
      result: completeData,
    });
  });
});
