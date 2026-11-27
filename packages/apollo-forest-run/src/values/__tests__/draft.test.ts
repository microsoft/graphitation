import { hydrateDraft } from "../draft";
import { createTestOperation } from "../../__tests__/helpers/descriptor";
import { ResolvedSelection } from "../../descriptor/types";
import { accumulate } from "../../jsutils/map";
import {
  createTestChunk,
  createTestDraft,
  generateChunk,
} from "../../__tests__/helpers/values";
import {
  ChunkMatcher,
  IncompleteValues,
  MissingFieldsMap,
  ObjectChunk,
  ObjectDraft,
  ObjectValue,
  SourceObject,
} from "../types";

describe("initial draft hydration", () => {
  it("creates simple object", () => {
    const draft = `{ foo }`;
    const chunks = [`{ foo }`];

    const result = draftHelper(draft, chunks);

    expect(result.data).toEqual({ foo: "foo" });
    expect(result.incompleteValues?.size).toEqual(0);
    expect(result.missingFields?.size).toEqual(0);
  });

  test("creates object from multiple chunks", () => {
    const draft = `{ foo, bar }`;
    const chunks = [`{ foo }`, `{ bar }`];

    const result = draftHelper(draft, chunks);

    expect(result.data).toEqual({ foo: "foo", bar: "bar" });
    expect(result.incompleteValues?.size).toEqual(0);
    expect(result.missingFields?.size).toEqual(0);
  });

  test("reports missing fields", () => {
    const draft = `{ foo, bar, baz }`;
    const chunks = [`{ foo }`, `{ bar }`];

    const result = draftHelper(draft, chunks);

    expect(result.data).toEqual({ foo: "foo", bar: "bar" });
    expect(fieldNames(result.missingFields, result.data)).toEqual(["baz"]);
    expect(fieldNames(result.incompleteValues, result.data)).toEqual(["baz"]);
  });

  test("creates object with deeply nested structure from multiple chunks", () => {
    const draft = `
      {
        post {
          title
          comments @mock(count: 2) {
            text
            author {
              firstName
              lastName
              lastPosts @mock(count: 2) {
                title
                date
              }
            }
          }
        }
      }
    `;
    // Note: lastName is not present in any chunk
    const chunks = [
      `{ post { comments @mock(count: 2) { text } } }`,
      `{
        post {
          comments @mock(count: 2) {
            author { firstName }
          }
        }
      }`,
      `{
        post {
          comments @mock(count: 2) {
            author {
              lastPosts @mock(count: 2) { title }
            }
          }
        }
      }`,
      `{
        post {
          comments @mock(count: 2) {
            author {
              lastPosts @mock(count: 2) { date }
            }
          }
        }
      }`,
      `{ post { title } }`,
    ];

    const result = draftHelper(draft, chunks);
    const source = result.data as any;

    expect(source).toEqual({
      post: {
        comments: [
          {
            text: "text",
            author: {
              firstName: "firstName",
              lastPosts: [
                { title: "title", date: "date" },
                { title: "title", date: "date" },
              ],
            },
          },
          {
            text: "text",
            author: {
              firstName: "firstName",
              lastPosts: [
                { title: "title", date: "date" },
                { title: "title", date: "date" },
              ],
            },
          },
        ],
        title: "title",
      },
    });
    expect(result.missingFields?.size).toEqual(2);
    expect(
      fieldNames(result.missingFields, source?.post?.comments?.[0]?.author),
    ).toEqual(["lastName"]);
    expect(
      fieldNames(result.missingFields, source?.post?.comments?.[1]?.author),
    ).toEqual(["lastName"]);

    expect(result.incompleteValues?.size).toEqual(7);
    expect(result.incompleteValues?.has(source));
    expect(result.incompleteValues?.has(source.post));
    expect(result.incompleteValues?.has(source.post.comments));
    expect(result.incompleteValues?.has(source.post.comments[0]));
    expect(result.incompleteValues?.has(source.post.comments[1]));
    expect(result.incompleteValues?.has(source.post.comments[0].author));
    expect(result.incompleteValues?.has(source.post.comments[1].author));
  });
});

describe("draft amendments", () => {
  it("can resume previous completion with a different set of chunks", () => {
    const draft = `{ foo, bar, baz }`;
    const chunks = [
      `{ foo @mock(value: "foo value") }`,
      `{ bar @mock(value: "bar value") }`,
    ];

    const intermediate = draftHelper(draft, chunks);
    // sanity-checks:
    expect(intermediate.data).toEqual({ foo: "foo value", bar: "bar value" });
    expect(
      fieldNames(intermediate.incompleteValues, intermediate.data),
    ).toEqual(["baz"]);

    const moreChunks = [
      `{ foo @mock(value: "should be ignored"), bar @mock(value: "should be ignored") }`,
      `{ baz }`,
    ];
    const result = amendDraftHelper(intermediate.testDraft, moreChunks);

    expect(result.data).toEqual({
      foo: "foo value",
      bar: "bar value",
      baz: "baz",
    });
    expect(result.incompleteValues?.size).toEqual(0);
    expect(result.missingFields?.size).toEqual(0);
  });
});

describe("object recycling", () => {
  it("does not recycle objects by default", () => {
    const query = `{ id, foo }`;
    const chunks = [`{ id @mock(value: "rootId"), foo }`].map(generateChunk);
    const rootChunk = chunks[0].value;
    const testDraft = hydrateDraft(env, createTestDraft(query), rootChunk);

    expect(testDraft.data).toEqual({
      id: "rootId",
      foo: "foo",
    });
    expect(rootChunk.data).toEqual(testDraft.data);
    expect(rootChunk.data).not.toBe(testDraft.data);
  });

  it("recycles root-level object", () => {
    const query = `{ id, foo }`;
    const chunks = [`{ id @mock(value: "rootId"), foo }`].map(generateChunk);

    const rootChunk = chunks[0].value;
    const chunkMatcher = (key: any) =>
      key === "rootId" ? rootChunk : undefined;
    const testDraft = hydrateDraft(
      env,
      createTestDraft(query),
      rootChunk,
      chunkMatcher,
    );

    expect(testDraft.data).toEqual({
      id: "rootId",
      foo: "foo",
    });
    expect(testDraft.data).toBe(rootChunk.data);
  });

  it("recycles embedded object", () => {
    const query = `{ foo { id, bar } }`;
    const chunks = [`{ foo { id @mock(value: "fooId"), bar } }`].map(
      generateChunk,
    );

    const rootChunk = chunks[0].value;
    const embeddedChunk = chunks[0].nodes.get("fooId")?.[0];
    const chunkMatcher = (key: any) =>
      key === "fooId" ? embeddedChunk : undefined;
    const testDraft = hydrateDraft(
      env,
      createTestDraft(query),
      rootChunk,
      chunkMatcher,
    );

    expect(testDraft.data).toEqual({
      foo: {
        id: "fooId",
        bar: "bar",
      },
    });
    expect(rootChunk.data).toEqual(testDraft.data);
    expect(rootChunk.data).not.toBe(testDraft.data); // The root object is not recycled
    expect(testDraft.data?.foo).toBe(rootChunk.data?.foo); // The embedded object is recycled
  });

  it("skips recycling for incomplete objects", () => {
    const query = `{ id, foo, missing { bar } }`;
    const chunks = [
      `{ id @mock(value: "rootId"), foo, missing @mock(missing: true) { bar } }`,
    ].map(generateChunk);

    const rootChunk = chunks[0].value;
    const chunkMatcher = (key: any) =>
      key === "rootId" ? rootChunk : undefined;
    const testDraft = hydrateDraft(
      env,
      createTestDraft(query),
      rootChunk,
      chunkMatcher,
    );

    expect(testDraft.data).toEqual({ id: "rootId", foo: "foo" });
    expect(testDraft.data).not.toBe(rootChunk.data);
    expect(testDraft.missingFields?.size).toBe(1);
  });
});

describe("handling fragments, unions, and interfaces", () => {
  test("handles fragments and inline fragments", () => {
    const query = `
      {
        user {
          ...UserFields
          ... on User {
            title
          }
          ... on Admin {
            permissions
          }
        }
      }
      fragment UserFields on User {
        id
        name
      }
    `;
    const chunks = [
      `{ user { __typename @mock(value: "User") name } }`,
      `{ user { __typename @mock(value: "User") title } }`,
      `{ user { permissions } }`,
    ];

    const result = draftHelper(query, chunks);
    const source = result.data as any;

    expect(source).toEqual({
      user: {
        name: "name",
        title: "title",
        // permissions shouldn't be resolved due to type mismatch
      },
    });

    expect(fieldNames(result.missingFields, source.user)).not.toContain(
      "points",
    );
  });

  test("handles abstract types", () => {
    const query = `
      {
        searchResults {
          __typename
          ... on User {
            id
            name
          }
          ... on Post {
            id
            title
          }
        }
      }
    `;
    const searchQuery = `{ searchResults { __typename, ... on User { id } ... on Post { id } } }`;
    const userQuery = `{ node { ... on User { id, name }, __typename } }`; // __typename is intentionally outside of User selection
    const postQuery = `{ node { ... on Post { id, title, __typename } } }`;

    const searchChunkInfo = createTestChunk(searchQuery, {
      searchResults: [
        { __typename: "User", id: "user1" },
        { __typename: "Post", id: "post1" },
      ],
    });
    const userChunkInfo = createTestChunk(userQuery, {
      node: {
        __typename: "User",
        id: "user1",
        name: "Alice",
      },
    });
    const postChunkInfo = createTestChunk(postQuery, {
      node: {
        __typename: "Post",
        id: "post1",
        title: "Hello World",
      },
    });
    const getChunks = (key: any) => [
      ...(searchChunkInfo.nodes.get(key) ?? []),
      ...(userChunkInfo.nodes.get(key) ?? []),
      ...(postChunkInfo.nodes.get(key) ?? []),
    ];
    const result = hydrateDraft(env, createTestDraft(query), getChunks);

    expect(result.data).toEqual({
      searchResults: [
        { __typename: "User", id: "user1", name: "Alice" },
        { __typename: "Post", id: "post1", title: "Hello World" },
      ],
    });
  });
});

describe("error handling", () => {
  test("throws an error when data has invalid structure", () => {
    const query = `{ foo { bar } }`;
    const chunks = [`{ foo @mock(value: "invalid") }`]; // 'foo' should be an object

    expect(() => draftHelper(query, chunks)).toThrow();
  });

  test("hydrates data when dealing with scalar fields that have selection sets", () => {
    const query = `{ foo { bar } }`;
    const chunks = [`{ foo @mock(value: 42) }`]; // 'foo' is a scalar, but selection expects an object

    expect(() => draftHelper(query, chunks)).toThrow();
  });
});

describe("data merging and conflicts", () => {
  test("merges data from multiple chunks with conflicting fields", () => {
    const query = `{ foo }`;
    const chunks = [
      `{ foo @mock(value: "value1") }`,
      `{ foo @mock(value: "value2") }`,
    ];

    const result = draftHelper(query, chunks);

    expect(result.data).toEqual({ foo: "value1" }); // first chunk's value takes precedence
  });
});

describe("handling directives", () => {
  test("handles directives other than @mock", () => {
    const query = `{ foo @include(if: false), bar }`;
    const chunks = [`{ foo @mock(value: "fooValue"), bar }`];

    const result = draftHelper(query, chunks);

    expect(result.data).toEqual({ bar: "bar" });
    expect(fieldNames(result.missingFields, result.data)).not.toContain("foo");
  });
});

describe("handling null values", () => {
  test("handles lists with null items", () => {
    const query = `
      {
        items {
          id
          value
        }
      }
    `;
    const chunks = [
      `{ items @mock(value: [{ id: "1", value: "value1" }, null]) { id, value} }`,
    ];

    const result = draftHelper(query, chunks);
    const source = result.data as any;

    expect(source).toEqual({
      items: [{ id: "1", value: "value1" }, null],
    });

    expect(result.missingFields?.size).toEqual(0);
  });

  test("hydrates data with null values in nested objects", () => {
    const query = `{ user { id, profile { bio } } }`;
    const chunks = [
      `{ user { id @mock(value: "user1"), profile @mock(value: null) { bio } } }`,
    ];

    const result = draftHelper(query, chunks);

    expect(result.data).toEqual({
      user: {
        id: "user1",
        profile: null,
      },
    });

    expect(result.missingFields?.size).toEqual(0);
  });
});

describe("handling nested lists and complex structures", () => {
  test("hydrates data with nested lists", () => {
    const query = `
      {
        users {
          id
          posts {
            id
            comments {
              id
              text
            }
          }
        }
      }
    `;
    const chunks = [
      `{ users @mock(count: 2) { id, posts @mock(count: 2) { id } } }`,
      `{ users @mock(count: 2) { posts @mock(count: 2) { comments @mock(count: 2) { id, text } } } }`,
    ];

    const result = draftHelper(query, chunks);
    const source = result.data as any;

    expect(source.users.length).toBe(2);
    source.users.forEach((user: any) => {
      expect(user.posts.length).toBe(2);
      user.posts.forEach((post: any) => {
        expect(post.comments.length).toBe(2);
      });
    });

    expect(result.missingFields?.size).toEqual(0);
  });

  test("visits every chunk once per draft", () => {
    // Missing fields will keep execution running until all chunks are traversed
    // At least we should make sure the same chunk is not re-entered twice per the same object
    const query = `
      {
        me {
          __typename
          id
          name2 # Note: this field is missing in existing chunks
          lastPost {
            id
            author {
              __typename
              id
              name
            }
          }
        }
      }
    `;
    const chunks = [
      `{ me { __typename @mock(value: "User") id @mock(value: "1") label: chunk1 } }`,
      `{
         user {
           __typename @mock(value: "User")
           id @mock(value: "1")
           label: chunk2 
           lastPost {
            __typename @mock(value: "Post")
             id
             author {
               __typename @mock(value: "User")
               id @mock(value: "1")
               label: chunk3
             }
           }
         }
       }`,
      `{
         user {
           __typename @mock(value: "User")
           id @mock(value: "1")
           label: chunk4 
           lastPost {
            __typename @mock(value: "Post")
             id
             author {
               __typename @mock(value: "User")
               id @mock(value: "1")
               label: chunk5
             }
           }
         }
       }`,
    ];

    const visited: any = new Map<object, object[]>();
    const enterObject = (_selection: any, chunk: any, draft: any) => {
      accumulate(
        visited,
        draft,
        `${chunk.type}:${chunk.key}:${chunk.data?.label ?? "-"}`,
      );
    };
    const result = draftHelper(query, chunks, { enterObject }) as any;
    const source = result.data;

    // Sanity checks
    expect(source).toEqual({
      me: {
        __typename: "User",
        id: "1",
        lastPost: { id: "id", author: { __typename: "User", id: "1" } },
      },
    });
    expect(result.missingFields?.size).toEqual(2);

    expect(visited.size).toEqual(4);
    expect(visited.get(source)).toEqual(["Query:ROOT_QUERY:-"]);
    expect(visited.get(source.me)).toEqual(["User:1:chunk1"]);
    // Without proper deduplication, the following objects are re-visited many times
    expect(visited.get(source.me?.lastPost)).toEqual(["Post:id:-"]);
    expect(visited.get(source.me?.lastPost.author)).toEqual(["User:1:chunk3"]);
  });
});

const env = { keyMap: new WeakMap() };

type HelperOptions = {
  chunkMatcher?: ChunkMatcher;
  enterObject?: (
    selection: ResolvedSelection,
    model: ObjectValue,
    data: SourceObject,
  ) => void;
};

function draftHelper(
  query: string,
  chunkSelections: string[],
  options?: HelperOptions,
) {
  const op = createTestOperation(query);
  const chunksInfo = chunkSelections.map((obj) => generateChunk(obj));
  const getChunks = (key: string): ObjectChunk[] =>
    chunksInfo.flatMap((chunkInfo) => chunkInfo.nodes.get(key)?.flat() ?? []);

  const testDraft = createTestDraft(op);
  const result = hydrateDraft(
    env,
    testDraft,
    getChunks as any,
    options?.chunkMatcher,
    options?.enterObject,
  );

  return { ...result, testDraft, chunksInfo, getChunks };
}

function amendDraftHelper(testDraft: ObjectDraft, chunks: string[]) {
  const getChunks = () => chunks.map((obj) => generateChunk(obj).value);

  return hydrateDraft(env, testDraft, getChunks);
}

function fieldNames(
  map: IncompleteValues | MissingFieldsMap | undefined,
  obj: SourceObject | undefined,
) {
  const fields = obj && map ? map.get(obj) ?? [] : [];
  return [...fields].map((f) => f.name);
}
