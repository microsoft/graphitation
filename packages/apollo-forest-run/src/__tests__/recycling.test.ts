import { gql } from "@apollo/client";
import { ForestRunCache } from "../ForestRunCache";

describe("within the same operation", () => {
  it("uses first incoming result as an output", () => {
    const cache = new ForestRunCache();
    const query = gql`
      {
        a {
          b
        }
      }
    `;
    const input = {
      a: { b: "foo" },
    };
    cache.write({ query, result: input });
    const output = cache.diff({ query, optimistic: true });

    expect(output.result).toBe(input);
  });

  it("recycles first incoming result, when the second result has no changes", () => {
    const cache = new ForestRunCache();
    const query = gql`
      {
        a {
          b
        }
      }
    `;
    const input = {
      a: { b: "foo" },
    };
    const noChanges = {
      a: { b: "foo" },
    };
    cache.write({ query, result: input });
    cache.write({ query, result: noChanges });
    const output = cache.diff({ query, optimistic: true });

    expect(output.result).toBe(input);
  });

  it("recycles nested objects on updates", () => {
    const cache = new ForestRunCache();
    const query = gql`
      {
        a {
          b
        }
        c
      }
    `;
    const input = {
      a: { b: "foo" },
      c: "bar",
    };
    const updated = {
      a: { b: "foo" },
      c: "updated",
    };
    cache.write({ query, result: input });
    cache.write({ query, result: updated });
    const output = cache.diff<typeof input>({ query, optimistic: true });

    expect(output.result).not.toBe(updated);
    expect(output.result?.a).toBe(input.a);
  });

  // TODO
  it.skip("recycles sibling objects on updates", () => {
    const cache = new ForestRunCache();
    const query = gql`
      {
        a {
          b {
            c
          }
          d {
            e
          }
        }
      }
    `;
    const input = {
      a: {
        b: { c: "foo" },
        d: { e: "bar" },
      },
    };
    const updated = {
      a: {
        b: { c: "foo" },
        d: { e: "updated" },
      },
    };
    cache.write({ query, result: input });
    cache.write({ query, result: updated });
    const output = cache.diff<typeof input>({ query, optimistic: true });

    expect(output.result).not.toBe(updated);
    expect(output.result?.a.b).toBe(input.a.b);
    expect(output.result?.a.d).toBe(updated.a.d);
  });

  it("recycles lists on updates", () => {
    const cache = new ForestRunCache();
    const query = gql`
      {
        a {
          b
        }
        c
      }
    `;
    const input = {
      a: [{ b: "foo1" }, { b: "foo2" }],
      c: "bar",
    };
    const updated = {
      a: [{ b: "foo1" }, { b: "foo2" }],
      c: "baz",
    };
    cache.write({ query, result: input });
    cache.write({ query, result: updated });
    const output = cache.diff<typeof input>({ query, optimistic: true });

    expect(output.result).not.toBe(updated);
    expect(output.result?.a).toBe(input.a);
  });

  // TODO
  it.skip("recycles list items on updates", () => {
    const cache = new ForestRunCache();
    const query = gql`
      {
        a {
          b
        }
      }
    `;
    const input = {
      a: [{ b: "foo1" }, { b: "foo2" }],
    };
    const updated = {
      a: [{ b: "foo1" }, { b: "foo3" }],
    };
    cache.write({ query, result: input });
    cache.write({ query, result: updated });
    const output = cache.diff<typeof input>({ query, optimistic: true });

    expect(output.result).not.toBe(updated);
    expect(output.result?.a).not.toBe(updated.a);
    expect(output.result?.a[0]).toBe(input.a[0]);
    expect(output.result?.a[1]).toBe(updated.a[1]);
  });

  describe("with variables", () => {
    it("recycles objects with the same arguments", () => {
      const cache = new ForestRunCache();
      const query = gql`
        query ($foo: Boolean!) {
          a(arg: $foo) {
            b
          }
        }
      `;
      const input = {
        a: { b: "foo" },
      };
      const updated = {
        a: { b: "foo" },
      };
      cache.write({ query, result: input, variables: { foo: true } });
      cache.write({ query, result: updated, variables: { foo: true } });
      const output = cache.diff<typeof input>({
        query,
        variables: { foo: true },
        optimistic: true,
      });

      expect(output.result?.a).toBe(input.a);
      expect(output.result).toBe(input);
    });

    it("recycles objects with the same arguments in nested fields", () => {
      const cache = new ForestRunCache();
      const query = gql`
        query ($foo: Boolean!) {
          a {
            b(arg: $foo)
          }
        }
      `;
      const input = {
        a: { b: "foo" },
      };
      const updated = {
        a: { b: "foo" },
      };
      cache.write({ query, result: input, variables: { foo: true } });
      cache.write({ query, result: updated, variables: { foo: true } });
      const output = cache.diff<typeof input>({
        query,
        variables: { foo: true },
        optimistic: true,
      });

      expect(output.result?.a).toBe(input.a);
      expect(output.result).toBe(input);
    });
  });
});

// TODO: recycling when there are:
//  - variables at different levels (i.e. different operations with the same document)
//  - merge policies
//  - read policies
//  - optimistic responses
// TODO: recycling of objects with identical selections? Probably costs outweight benefits
