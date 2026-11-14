import { gql } from "@apollo/client";
import type { Cache } from "@apollo/client";
import { ForestRun } from "../ForestRun";

// Mirrors Apollo QueryInfo: queries are watched (and diffed) while their requests are in flight
const watchQuery = (
  cache: ForestRun,
  query: any,
  variables?: Record<string, unknown>,
) => {
  const callback = jest.fn();
  const watch: Cache.WatchOptions = {
    query,
    variables,
    optimistic: true,
    returnPartialData: true,
    callback: (diff) => {
      watch.lastDiff = diff;
      callback(diff);
    },
  };
  cache.watch(watch);
  watch.lastDiff = cache.diff(watch);
  return { watch, callback };
};

const messageQuery = (field: string) => gql`
  query Message_${field}($id: ID!) {
    message(id: $id) {
      id
      ${field}
    }
  }
`;

const message = (id: string, fields: Record<string, unknown>) => ({
  message: { __typename: "Message", id, ...fields },
});

describe("pending partial watches", () => {
  const A = messageQuery("a");
  const B = messageQuery("b");
  const C = messageQuery("c");
  const variables = { id: "1" };

  it("are not re-hydrated or re-notified by sibling writes with unrelated fields of the same node", () => {
    const cache = new ForestRun();
    const a = watchQuery(cache, A, variables);
    watchQuery(cache, B, variables);
    watchQuery(cache, C, variables);

    cache.write({ query: B, variables, result: message("1", { b: "b" }) });
    const partial = cache.diff(a.watch);
    expect(partial.complete).toBe(false);
    a.callback.mockClear();

    cache.write({ query: C, variables, result: message("1", { c: "c" }) });

    expect(a.callback).not.toHaveBeenCalled();
    expect(cache.diff(a.watch).result).toBe(partial.result);

    cache.write({ query: A, variables, result: message("1", { a: "a" }) });

    expect(a.callback).toHaveBeenCalledTimes(1);
    expect(cache.diff(a.watch)).toMatchObject({
      complete: true,
      result: message("1", { a: "a" }),
    });
  });

  it("match missing fields by arguments, regardless of aliases", () => {
    const Html = gql`
      query Html {
        message(id: "1") {
          id
          text(format: "html")
        }
      }
    `;
    const Plain = gql`
      query Plain {
        message(id: "1") {
          id
          text(format: "plain")
        }
      }
    `;
    const PlainWithC = gql`
      query PlainWithC {
        message(id: "1") {
          id
          c
          text(format: "plain")
        }
      }
    `;
    const AliasedHtml = gql`
      query AliasedHtml {
        message(id: "1") {
          id
          html: text(format: "html")
        }
      }
    `;
    const cache = new ForestRun();
    const html = watchQuery(cache, Html);
    watchQuery(cache, PlainWithC);
    watchQuery(cache, AliasedHtml);

    cache.write({ query: Plain, result: message("1", { text: "plain" }) });
    const partial = cache.diff(html.watch);
    expect(partial.complete).toBe(false);
    html.callback.mockClear();

    // Brings `text(format: "plain")` again (unchanged) along with the changed `c`
    cache.write({
      query: PlainWithC,
      result: message("1", { c: "c", text: "plain" }),
    });

    expect(html.callback).not.toHaveBeenCalled();
    expect(cache.diff(html.watch).result).toBe(partial.result);

    cache.write({
      query: AliasedHtml,
      result: message("1", { html: "<b>html</b>" }),
    });

    expect(html.callback).toHaveBeenCalledTimes(1);
    expect(cache.diff(html.watch)).toMatchObject({
      complete: true,
      result: message("1", { text: "<b>html</b>" }),
    });
  });

  it("conservatively re-hydrate missing fields with read policies when incoming result brings the node", () => {
    const cache = new ForestRun({
      typePolicies: {
        Message: {
          fields: {
            a: {
              read: (existing, { readField }) =>
                existing ?? readField<string>("c") ?? undefined,
            },
          },
        },
      },
    });
    const WithOther = gql`
      query WithOther {
        message(id: "1") {
          id
          a
        }
        other {
          id
        }
      }
    `;
    const Seed = gql`
      query Seed {
        message(id: "1") {
          id
        }
        other {
          id
          x
        }
      }
    `;
    const OtherAndC = gql`
      query OtherAndC {
        message(id: "1") {
          id
          c
        }
        other {
          id
          x
        }
      }
    `;
    const other = (x: string) => ({ __typename: "Other", id: "1", x });
    cache.write({
      query: Seed,
      result: { ...message("1", {}), other: other("x1") },
    });
    const { watch, callback } = watchQuery(cache, WithOther);
    expect(cache.diff(watch).complete).toBe(false);

    // `Message:1.c` is new data (not a change); `Other:1.x` changes, but is not selected by WithOther
    cache.write({
      query: OtherAndC,
      result: { ...message("1", { c: "c" }), other: other("x2") },
    });

    expect(callback).toHaveBeenCalledTimes(1);
    expect(cache.diff(watch)).toMatchObject({
      complete: true,
      result: { ...message("1", { a: "c" }), other: { id: "1" } },
    });
  });
});
