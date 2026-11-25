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

const createLogger = () => ({
  debug: jest.fn(),
  log: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
});

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

  describe("subsequent results", () => {
    const subsequentResults = {
      latest: {
        incremental: [{ id: "0", data: { details: "World" } }],
        completed: [{ id: "0" }],
        hasNext: false,
      },
      draft2022: {
        incremental: [
          { path: ["message"], label: "details", data: { details: "World" } },
        ],
        hasNext: false,
      },
    };

    it.each(Object.entries(subsequentResults))(
      "ignores subsequent results (%s format) without touching the cache",
      (_, execution) => {
        const logger = createLogger();
        const cache = new ForestRun({ logger });
        cache.write({ query, execution: { data: initialData, hasNext: true } });
        const before = cache.extract();
        const watch = jest.fn();
        cache.watch({ query, optimistic: true, callback: watch });

        const ref = cache.write({ query, execution });
        cache.write({ query, execution });

        expect(ref).toBeUndefined();
        expect(watch).not.toHaveBeenCalled();
        expect(cache.extract()).toEqual(before);
        expect(logger.warn).toHaveBeenCalledTimes(1);
      },
    );

    it("ignores subsequent results within a transaction", () => {
      const cache = new ForestRun({ logger: createLogger() });
      cache.write({ query, execution: { data: initialData, hasNext: true } });
      const before = cache.extract();

      cache.batch({
        update: () => {
          const ref = cache.write({
            query,
            execution: subsequentResults.latest,
          });
          expect(ref).toBeUndefined();
        },
      });

      expect(cache.extract()).toEqual(before);
    });
  });
});
