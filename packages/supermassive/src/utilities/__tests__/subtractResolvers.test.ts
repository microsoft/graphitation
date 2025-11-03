import { subtractResolvers } from "../subtractResolvers";
import { Resolvers } from "../../types";

describe("subtractResolvers", () => {
  describe("complete type resolver removal", () => {
    it("should remove entire type resolver when it exists in subtrahend", () => {
      const minuend: Resolvers = {
        Query: {
          user: () => ({ id: "1", name: "John" }),
          posts: () => [{ id: "1", title: "Post 1" }],
        },
        User: {
          name: (source: any) => source.name,
          email: (source: any) => source.email,
        },
      };

      const subtrahend: Resolvers = {
        User: {
          name: (source: any) => source.name,
          email: (source: any) => source.email,
        },
      };

      const result = subtractResolvers(minuend, subtrahend);

      expect(result).toEqual({
        Query: {
          user: expect.any(Function),
          posts: expect.any(Function),
        },
      });
      expect(result.User).toBeUndefined();
    });

    it("should keep all resolvers when subtrahend is empty", () => {
      const minuend: Resolvers = {
        Query: {
          user: () => ({ id: "1", name: "John" }),
        },
      };

      const subtrahend: Resolvers = {};

      const result = subtractResolvers(minuend, subtrahend);

      expect(result).toEqual({
        Query: {
          user: expect.any(Function),
        },
      });
    });

    it("should return empty object when minuend equals subtrahend", () => {
      const resolvers: Resolvers = {
        Query: {
          user: () => ({ id: "1", name: "John" }),
        },
      };

      const result = subtractResolvers(resolvers, resolvers);

      expect(result).toEqual({});
    });
  });

  describe("partial field resolver subtraction", () => {
    it("should subtract field resolvers that exist in subtrahend", () => {
      const minuend: Resolvers = {
        Query: {
          user: () => ({ id: "1", name: "John" }),
          users: () => [{ id: "1", name: "John" }],
          posts: () => [{ id: "1", title: "Post 1" }],
          post: () => ({ id: "1", title: "Post 1" }),
        },
      };

      const subtrahend: Resolvers = {
        Query: {
          users: () => [],
          posts: () => [],
        },
      };

      const result = subtractResolvers(minuend, subtrahend);

      expect(result).toEqual({
        Query: {
          user: expect.any(Function),
          post: expect.any(Function),
        },
      });
      expect((result.Query as any)?.users).toBeUndefined();
      expect((result.Query as any)?.posts).toBeUndefined();
    });

    it("should remove type resolver if all field resolvers are subtracted", () => {
      const minuend: Resolvers = {
        Query: {
          user: () => ({ id: "1", name: "John" }),
        },
        User: {
          name: (source: any) => source.name,
          email: (source: any) => source.email,
        },
      };

      const subtrahend: Resolvers = {
        Query: {
          user: () => null,
        },
      };

      const result = subtractResolvers(minuend, subtrahend);

      expect(result.Query).toBeUndefined();
      expect(result.User).toEqual({
        name: expect.any(Function),
        email: expect.any(Function),
      });
    });

    it("should handle field resolvers by key only, not by implementation", () => {
      const minuend: Resolvers = {
        Query: {
          user: () => ({ id: "1", name: "John" }),
        },
      };

      const subtrahend: Resolvers = {
        Query: {
          // Different implementation, but same key
          user: () => ({ id: "2", name: "Jane" }),
        },
      };

      const result = subtractResolvers(minuend, subtrahend);

      // Field should be removed because key matches
      expect(result).toEqual({});
    });
  });

  describe("nested resolver objects", () => {
    it("should handle nested type resolvers", () => {
      const minuend: Resolvers = {
        Query: {
          user: () => ({ id: "1" }),
        },
        User: {
          name: (source: any) => source.name,
          posts: (source: any) => source.posts,
        },
        Post: {
          title: (source: any) => source.title,
          author: (source: any) => source.author,
        },
      };

      const subtrahend: Resolvers = {
        User: {
          posts: (source) => [],
        },
        Post: {
          title: (source) => "",
          author: (source) => null,
        },
      };

      const result = subtractResolvers(minuend, subtrahend);

      expect(result).toEqual({
        Query: {
          user: expect.any(Function),
        },
        User: {
          name: expect.any(Function),
        },
      });
      expect(result.Post).toBeUndefined();
    });
  });

  describe("subscription resolvers", () => {
    it("should subtract subscription resolvers", () => {
      const minuend: Resolvers = {
        Subscription: {
          messageAdded: {
            subscribe: () => ({
              [Symbol.asyncIterator]: () => ({
                next: async () => ({
                  done: false,
                  value: { messageAdded: "hi" },
                }),
              }),
            }),
          },
          userOnline: {
            subscribe: () => ({
              [Symbol.asyncIterator]: () => ({
                next: async () => ({
                  done: false,
                  value: { userOnline: true },
                }),
              }),
            }),
          },
        },
      };

      const subtrahend: Resolvers = {
        Subscription: {
          userOnline: {
            subscribe: () => null,
          },
        },
      };

      const result = subtractResolvers(minuend, subtrahend);

      expect(result.Subscription).toEqual({
        messageAdded: {
          subscribe: expect.any(Function),
        },
      });
    });
  });

  describe("scalar and enum resolvers", () => {
    it("should subtract scalar type resolvers", () => {
      const minuend: Resolvers = {
        DateTime: {
          serialize: (value: Date) => value.toISOString(),
          parseValue: (value: string) => new Date(value),
          parseLiteral: (ast: any) => new Date(ast.value),
        },
        UUID: {
          serialize: (value: string) => value,
          parseValue: (value: string) => value,
        },
      };

      const subtrahend: Resolvers = {
        UUID: {
          serialize: (value: string) => value,
          parseValue: (value: string) => value,
        },
      };

      const result = subtractResolvers(minuend, subtrahend);

      expect(result.DateTime).toBeDefined();
      expect(result.UUID).toBeUndefined();
    });

    it("should subtract enum resolvers", () => {
      const minuend: Resolvers = {
        Role: {
          ADMIN: "admin",
          USER: "user",
          GUEST: "guest",
        },
        Status: {
          ACTIVE: "active",
          INACTIVE: "inactive",
        },
      };

      const subtrahend: Resolvers = {
        Status: {
          ACTIVE: "active",
          INACTIVE: "inactive",
        },
      };

      const result = subtractResolvers(minuend, subtrahend);

      expect(result.Role).toBeDefined();
      expect(result.Status).toBeUndefined();
    });
  });

  describe("interface resolvers", () => {
    it("should subtract interface type resolvers", () => {
      const minuend: Resolvers = {
        Node: {
          __resolveType: (obj: any) => {
            if (obj.name) return "User";
            if (obj.title) return "Post";
            return null;
          },
        },
        Timestamped: {
          __resolveType: (obj: any) => {
            if (obj.createdAt) return "User";
            return null;
          },
        },
      };

      const subtrahend: Resolvers = {
        Timestamped: {
          __resolveType: (obj: any) => null,
        },
      };

      const result = subtractResolvers(minuend, subtrahend);

      expect(result.Node).toBeDefined();
      expect(result.Timestamped).toBeUndefined();
    });
  });

  describe("union resolvers", () => {
    it("should subtract union type resolvers", () => {
      const minuend: Resolvers = {
        SearchResult: {
          __resolveType: (obj: any) => {
            if (obj.name) return "User";
            if (obj.title) return "Post";
            return null;
          },
        },
        MediaItem: {
          __resolveType: (obj: any) => {
            if (obj.url) return "Image";
            return null;
          },
        },
      };

      const subtrahend: Resolvers = {
        MediaItem: {
          __resolveType: (obj: any) => null,
        },
      };

      const result = subtractResolvers(minuend, subtrahend);

      expect(result.SearchResult).toBeDefined();
      expect(result.MediaItem).toBeUndefined();
    });
  });

  describe("handling arrays of resolvers", () => {
    it("should handle arrays in subtrahend", () => {
      const minuend: Resolvers = {
        Query: {
          user: () => ({ id: "1" }),
          posts: () => [],
        },
        User: {
          name: (source: any) => source.name,
        },
      };

      const subtrahend1: Resolvers = {
        Query: {
          posts: () => [],
        },
      };

      const subtrahend2: Resolvers = {
        User: {
          name: (source) => "",
        },
      };

      const result = subtractResolvers(minuend, [subtrahend1, subtrahend2]);

      expect(result).toEqual({
        Query: {
          user: expect.any(Function),
        },
      });
    });

    it("should handle nested arrays in subtrahend", () => {
      const minuend: Resolvers = {
        Query: {
          user: () => ({ id: "1" }),
          posts: () => [],
          comments: () => [],
        },
      };

      const result = subtractResolvers(minuend, [
        [
          { Query: { posts: () => [] } },
          { Query: { comments: () => [] } },
        ] as any,
      ]);

      expect(result).toEqual({
        Query: {
          user: expect.any(Function),
        },
      });
    });
  });

  describe("edge cases", () => {
    it("should handle non-object type resolver in subtrahend", () => {
      const minuend: Resolvers = {
        Query: {
          user: () => ({ id: "1" }),
        },
        User: {
          name: (source: any) => source.name,
        },
      };

      const subtrahend: Resolvers = {
        Query: "not an object" as any,
      };

      const result = subtractResolvers(minuend, subtrahend);

      // Should skip non-object resolvers in subtrahend
      expect(result).toEqual({
        Query: {
          user: expect.any(Function),
        },
        User: {
          name: expect.any(Function),
        },
      });
    });

    it("should handle undefined type resolvers in minuend", () => {
      const minuend: Resolvers = {
        Query: undefined as any,
        User: {
          name: (source: any) => source.name,
        },
      };

      const subtrahend: Resolvers = {
        Query: {
          user: () => null,
        },
      };

      const result = subtractResolvers(minuend, subtrahend);

      expect(result).toEqual({
        User: {
          name: expect.any(Function),
        },
      });
    });

    it("should not mutate input objects", () => {
      const minuend: Resolvers = {
        Query: {
          user: () => ({ id: "1" }),
          posts: () => [],
        },
      };

      const subtrahend: Resolvers = {
        Query: {
          posts: () => [],
        },
      };

      const originalMinuend = JSON.parse(
        JSON.stringify(minuend, (key, value) =>
          typeof value === "function" ? "FUNCTION" : value,
        ),
      );
      const originalSubtrahend = JSON.parse(
        JSON.stringify(subtrahend, (key, value) =>
          typeof value === "function" ? "FUNCTION" : value,
        ),
      );

      subtractResolvers(minuend, subtrahend);

      const serializedMinuend = JSON.parse(
        JSON.stringify(minuend, (key, value) =>
          typeof value === "function" ? "FUNCTION" : value,
        ),
      );
      const serializedSubtrahend = JSON.parse(
        JSON.stringify(subtrahend, (key, value) =>
          typeof value === "function" ? "FUNCTION" : value,
        ),
      );

      expect(serializedMinuend).toEqual(originalMinuend);
      expect(serializedSubtrahend).toEqual(originalSubtrahend);
    });
  });

  describe("complex scenarios", () => {
    it("should handle comprehensive resolver subtraction", () => {
      const minuend: Resolvers = {
        Query: {
          user: () => ({ id: "1" }),
          users: () => [],
          post: () => ({ id: "1" }),
          posts: () => [],
        },
        Mutation: {
          createUser: () => ({ id: "1" }),
          updateUser: () => ({ id: "1" }),
          deleteUser: () => true,
        },
        User: {
          name: (source: any) => source.name,
          email: (source: any) => source.email,
          posts: (source: any) => source.posts,
        },
        Post: {
          title: (source: any) => source.title,
          author: (source: any) => source.author,
        },
        DateTime: {
          serialize: (value: Date) => value.toISOString(),
        },
      };

      const subtrahend: Resolvers = {
        Query: {
          users: () => [],
          posts: () => [],
        },
        Mutation: {
          updateUser: () => null,
          deleteUser: () => false,
        },
        User: {
          posts: (source) => [],
        },
        Post: {
          title: (source) => "",
          author: (source) => null,
        },
      };

      const result = subtractResolvers(minuend, subtrahend);

      expect(result).toEqual({
        Query: {
          user: expect.any(Function),
          post: expect.any(Function),
        },
        Mutation: {
          createUser: expect.any(Function),
        },
        User: {
          name: expect.any(Function),
          email: expect.any(Function),
        },
        DateTime: {
          serialize: expect.any(Function),
        },
      });
      expect(result.Post).toBeUndefined();
    });
  });
});
