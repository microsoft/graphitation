import {
  createTestOperation,
  getFieldInfo,
} from "../../__tests__/helpers/descriptor";
import {
  ObjectChunk,
  ValueKind,
  GraphChunkReference,
  CompositeValueChunk,
  ObjectFieldReference,
  CompositeListChunk,
  CompositeNullChunk,
} from "../../values/types";
import { indexObject, indexTree } from "../indexTree";
import { ForestEnv } from "../types";
import {
  createSourceObject,
  isCompositeListValue,
  isObjectValue,
} from "../../values";
import { assert } from "../../jsutils/assert";

describe(indexTree, () => {
  it("indexes a simple query result", () => {
    const operation = createTestOperation(`
      {
        user(id: "user1") {
          __typename
          id
          name
          profile {
            __typename
            bio
            avatarUrl
          }
        }
      }
    `);
    const data: any = {
      user: {
        __typename: "User",
        id: "user1",
        name: "Alice",
        profile: {
          __typename: "Profile",
          bio: "Hello world!",
          avatarUrl: "http://example.com/avatar.jpg",
        },
      },
    };
    const result = {
      data: createSourceObject(data),
    };
    const indexedTree = indexTree(defaultEnv, operation, result);

    expect(indexedTree.result.data).toBe(data);
    expect(indexedTree.operation).toBe(operation);
    expect(indexedTree.rootNodeKey).toBe("ROOT_QUERY");
    expect(indexedTree.nodes.size).toBe(2);
    expect(indexedTree.dataMap.size).toBe(3);
    expect(indexedTree.typeMap.size).toBe(3);
    expect(indexedTree.incompleteChunks.size).toBe(0);
    expect([...indexedTree.nodes.keys()]).toEqual(["ROOT_QUERY", "user1"]);
    expect([...indexedTree.typeMap.keys()]).toEqual([
      "Query",
      "User",
      "Profile",
    ]);

    const root = indexedTree.nodes.get("ROOT_QUERY");
    const user = indexedTree.nodes.get("user1");
    const profile = getEmbeddedObjectChunk(user, "profile");

    const rootRef = indexedTree.dataMap.get(data);
    const userRef = indexedTree.dataMap.get(data.user);
    const profileRef = indexedTree.dataMap.get(data.user.profile);

    const typeQueryChunks = indexedTree.typeMap.get("Query");
    const typeUserChunks = indexedTree.typeMap.get("User");

    verifyObjectChunk(root, "ROOT_QUERY", data);
    verifyObjectChunk(user, "user1", data.user);
    verifyObjectChunk(profile, false, data.user.profile);

    verifyRootRef(rootRef, root);
    verifyObjectFieldRef(userRef, user, root, "user");
    verifyObjectFieldRef(profileRef, profile, user, "profile");

    verifyTypeChunks("Query", typeQueryChunks, [root?.[0]]);
    verifyTypeChunks("User", typeUserChunks, [user?.[0]]);
  });

  it("indexes lists of objects", () => {
    const operation = createTestOperation(`
      {
        user(id: "user1") {
          __typename
          id
          posts {
            __typename
            id
            title
          }
        }
      }
    `);
    const data: any = {
      user: {
        __typename: "User",
        id: "user1",
        posts: [
          { __typename: "Post", id: "post0", title: "First Post" },
          { __typename: "Post", id: "post1", title: "Second Post" },
        ],
      },
    };
    const result = {
      data: createSourceObject(data),
    };
    const indexedTree = indexTree(defaultEnv, operation, result);

    expect(indexedTree.rootNodeKey).toBe("ROOT_QUERY");
    expect(indexedTree.nodes.size).toBe(4); // ROOT_QUERY, user1 (user), post1, post2
    expect(indexedTree.dataMap.size).toBe(5); // same as nodes + an array
    expect(indexedTree.typeMap.size).toBe(3); // Query, User, Post
    expect(indexedTree.incompleteChunks.size).toBe(0);
    expect([...indexedTree.nodes.keys()]).toEqual([
      "ROOT_QUERY",
      "user1",
      "post0",
      "post1",
    ]);
    expect([...indexedTree.typeMap.keys()]).toEqual(["Query", "User", "Post"]);

    const root = indexedTree.nodes.get("ROOT_QUERY");
    const user = indexedTree.nodes.get("user1");
    const post0 = indexedTree.nodes.get("post0");
    const post1 = indexedTree.nodes.get("post1");
    const posts = getEmbeddedListChunk(user, "posts");

    const rootRef = indexedTree.dataMap.get(data);
    const userRef = indexedTree.dataMap.get(data.user);
    const postsRef = indexedTree.dataMap.get(data.user.posts);
    const post0Ref = indexedTree.dataMap.get(data.user.posts[0]);
    const post1Ref = indexedTree.dataMap.get(data.user.posts[1]);

    const typeQueryChunks = indexedTree.typeMap.get("Query");
    const typeUserChunks = indexedTree.typeMap.get("User");
    const typePostChunks = indexedTree.typeMap.get("Post");

    verifyObjectChunk(root, "ROOT_QUERY", data);
    verifyObjectChunk(user, "user1", data.user);
    verifyListChunk(posts, data.user.posts);
    verifyObjectChunk(post0, "post0", data.user.posts[0]);
    verifyObjectChunk(post1, "post1", data.user.posts[1]);

    verifyRootRef(rootRef, root);
    verifyObjectFieldRef(userRef, user, root, "user");
    verifyObjectFieldRef(postsRef, posts, user, "posts");
    verifyListItemRef(post0Ref, post0, posts, 0);
    verifyListItemRef(post1Ref, post1, posts, 1);

    verifyTypeChunks("Query", typeQueryChunks, [root?.[0]]);
    verifyTypeChunks("User", typeUserChunks, [user?.[0]]);
    verifyTypeChunks("Post", typePostChunks, [post0?.[0], post1?.[0]]);
  });

  it("handles missing composite fields", () => {
    const operation = createTestOperation(`
      {
        user(id: "user1") {
          __typename
          id
          name
          email
          profile {
            __typename
            bio
            avatarUrl
          }
        }
      }
    `);
    const data: any = {
      user: {
        __typename: "User",
        id: "user1",
        name: "Alice",
        // 'email' field is missing
        // 'profile' field is missing
      },
    };
    const result = {
      data: createSourceObject(data),
    };
    const indexedTree = indexTree(defaultEnv, operation, result);

    expect(indexedTree.rootNodeKey).toBe("ROOT_QUERY");
    expect(indexedTree.nodes.size).toBe(2);
    expect(indexedTree.dataMap.size).toBe(2);
    expect(indexedTree.typeMap.size).toBe(2);
    expect(indexedTree.incompleteChunks.size).toBe(1);
    expect([...indexedTree.nodes.keys()]).toEqual(["ROOT_QUERY", "user1"]);
    expect([...indexedTree.typeMap.keys()]).toEqual(["Query", "User"]);

    // Verify incomplete chunks
    const userNodes = indexedTree.nodes.get("user1") as ObjectChunk[];
    const userChunk = userNodes[0];
    expect(userNodes.length).toBe(1);
    expect(indexedTree.incompleteChunks.has(userChunk)).toBe(true);

    // Verify missingFields
    //   Indexing can only detect missing _composite_ fields, it is incapable to detect missing _leaf_ fields (because it won't visit those fields).
    //   Missing leaf fields can be only detected during _diffing_ OR with hints from calling side (see "indexes with known missing fields" test)
    expect(userChunk.missingFields).toBeDefined();
    expect(userChunk.missingFields?.size).toBe(1); // only detects 'profile' field as missing
    const emailField = getFieldInfo(userChunk.selection, ["email"]);
    const profileField = getFieldInfo(userChunk.selection, ["profile"]);
    expect(userChunk.missingFields?.has(profileField)).toBe(true);
    expect(userChunk.missingFields?.has(emailField)).toBe(false); // trading this inconsistency for perf

    // Verify that 'name' and 'id' are untouched
    expect(userChunk.data.name).toBe("Alice");
    expect(userChunk.data.id).toBe("user1");
  });

  it("indexes with known missing fields", () => {
    const operation = createTestOperation(`
      {
        user(id: "user1") {
          __typename
          id
          name
          email
        }
      }
    `);
    const data = {
      user: {
        __typename: "User",
        id: "user1",
        name: "Alice",
        // 'email' field is missing
      },
    };
    const result = {
      data: createSourceObject(data),
    };
    const emailField = getFieldInfo(operation.possibleSelections.get(null)!, [
      "user",
      "email",
    ]);
    const knownMissingFields = new Map([
      [data.user as any, new Set([emailField])],
    ]);
    const indexedTree = indexTree(
      defaultEnv,
      operation,
      result,
      knownMissingFields,
    );

    expect(indexedTree.rootNodeKey).toBe("ROOT_QUERY");
    expect(indexedTree.nodes.size).toBe(2);
    expect(indexedTree.dataMap.size).toBe(2);
    expect(indexedTree.typeMap.size).toBe(2);
    expect(indexedTree.incompleteChunks.size).toBe(1);
    expect([...indexedTree.nodes.keys()]).toEqual(["ROOT_QUERY", "user1"]);
    expect([...indexedTree.typeMap.keys()]).toEqual(["Query", "User"]);

    // Verify incomplete chunks
    const userNodes = indexedTree.nodes.get("user1") as ObjectChunk[];
    const userChunk = userNodes[0];
    expect(indexedTree.incompleteChunks.has(userChunk)).toBe(true);

    // Verify missingFields
    expect(userChunk.missingFields).toBeDefined();
    expect(userChunk.missingFields?.size).toBe(1);
    expect(userChunk.missingFields?.has(emailField)).toBe(true);

    // Verify that 'name' and 'id' are untouched
    expect(userChunk.data.name).toBe("Alice");
    expect(userChunk.data.id).toBe("user1");
  });

  it("recycles chunks from previous tree states", () => {
    const operation = createTestOperation(`
      {
        user(id: "user1") {
          __typename
          id
          profile {
            __typename
            bio
            avatarUrl
            social { githubUrl, linkedinUrl }
          }
          posts {
            __typename
            id
            title
          }
        }
      }
    `);
    const data1: any = {
      user: {
        __typename: "User",
        id: "user1",
        profile: {
          __typename: "Profile",
          bio: "Hello world!",
          avatarUrl: "https://example.com/avatar.jpg",
          social: {
            githubUrl: "https://github.com/example",
            linkedinUrl: "https://linkedin.com/example",
          },
        },
        posts: [
          { __typename: "Post", id: "post0", title: "First Post" },
          { __typename: "Post", id: "post1", title: "Second Post" },
        ],
      },
    };
    const indexedTree1 = indexTree(defaultEnv, operation, {
      data: createSourceObject(data1),
    });

    const data2: any = {
      user: {
        __typename: "User",
        id: "user1",
        profile: data1.user.profile,
        posts: [
          // post0 is deleted
          data1.user.posts[1],
          { __typename: "Post", id: "post2", title: "New Post" },
        ],
      },
    };
    const indexedTree2 = indexTree(
      defaultEnv,
      operation,
      { data: createSourceObject(data2) },
      undefined,
      indexedTree1,
    );

    // Verify that the profile chunk is recycled
    const user1 = indexedTree1.nodes.get("user1")?.[0] as ObjectChunk;
    const user2 = indexedTree2.nodes.get("user1")?.[0] as ObjectChunk;

    const profile1 = getEmbeddedObjectChunk(user1, "profile");
    const profile2 = getEmbeddedObjectChunk(user2, "profile");

    const post1_1 = indexedTree1.nodes.get("post1")?.[0] as ObjectChunk;
    const post1_2 = indexedTree2.nodes.get("post1")?.[0] as ObjectChunk;

    expect(user2).toBeDefined();
    expect(profile2).toBeDefined();
    expect(post1_2).toBeDefined();

    expect(user2).not.toBe(user1);
    expect(profile2).toBe(profile1);
    expect(post1_2).toBe(post1_1);

    // Verify dataMap is updated
    const social2 = getEmbeddedObjectChunk(profile2, "social");
    expect(indexedTree2.dataMap.get(user2.data)?.value).toBe(user2);
    expect(indexedTree2.dataMap.get(profile2.data)?.value).toBe(profile2);
    expect(indexedTree2.dataMap.get(social2.data)?.value).toBe(social2);
    expect(indexedTree2.dataMap.get(post1_2.data)?.value).toBe(post1_2);

    // Verify incomplete chunks
    expect(indexedTree2.incompleteChunks.size).toBe(0);
  });

  it("indexes interfaces and unions", () => {
    const operation = createTestOperation(`
      {
        search {
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
    `);
    const data: any = {
      search: [
        { __typename: "User", id: "user1", name: "Alice" },
        { __typename: "Post", id: "post1", title: "First Post" },
      ],
    };
    const indexedTree = indexTree(defaultEnv, operation, {
      data: createSourceObject(data),
    });

    expect(indexedTree.rootNodeKey).toBe("ROOT_QUERY");
    expect(indexedTree.nodes.size).toBe(3); // ROOT_QUERY, user1, post1
    expect(indexedTree.dataMap.size).toBe(4);
    expect(indexedTree.typeMap.size).toBe(3); // Query, User, Post
    expect(indexedTree.incompleteChunks.size).toBe(0);
    expect([...indexedTree.nodes.keys()]).toEqual([
      "ROOT_QUERY",
      "user1",
      "post1",
    ]);
    expect([...indexedTree.typeMap.keys()]).toEqual(["Query", "User", "Post"]);

    const root = indexedTree.nodes.get("ROOT_QUERY");
    const search = getEmbeddedListChunk(root, "search");
    const user = indexedTree.nodes.get("user1");
    const post1 = indexedTree.nodes.get("post1");

    const rootRef = indexedTree.dataMap.get(data);
    const searchRef = indexedTree.dataMap.get(data.search);
    const userRef = indexedTree.dataMap.get(data.search[0]);
    const post1Ref = indexedTree.dataMap.get(data.search[1]);

    const typeQueryChunks = indexedTree.typeMap.get("Query");
    const typeUserChunks = indexedTree.typeMap.get("User");
    const typePostChunks = indexedTree.typeMap.get("Post");

    verifyObjectChunk(root, "ROOT_QUERY", data);
    verifyListChunk(search, data.search);
    verifyObjectChunk(user, "user1", data.search[0]);
    verifyObjectChunk(post1, "post1", data.search[1]);

    verifyRootRef(rootRef, root);
    verifyObjectFieldRef(searchRef, search, root, "search");
    verifyListItemRef(userRef, user, search, 0);
    verifyListItemRef(post1Ref, post1, search, 1);

    verifyTypeChunks("Query", typeQueryChunks, [root?.[0]]);
    verifyTypeChunks("User", typeUserChunks, [user?.[0]]);
    verifyTypeChunks("Post", typePostChunks, [post1?.[0]]);
  });

  it("handles null values", () => {
    const operation = createTestOperation(`
      {
        user(id: "user1") {
          __typename
          id
          profile {
            __typename
            bio
            avatarUrl
          }
        }
      }
    `);
    const data: any = {
      user: {
        __typename: "User",
        id: "user1",
        profile: null,
      },
    };
    const indexedTree = indexTree(defaultEnv, operation, {
      data: createSourceObject(data),
    });

    expect(indexedTree.rootNodeKey).toBe("ROOT_QUERY");
    expect(indexedTree.nodes.size).toBe(2); // ROOT_QUERY, user1
    expect(indexedTree.dataMap.size).toBe(2);
    expect(indexedTree.typeMap.size).toBe(2);

    const user = indexedTree.nodes.get("user1")?.[0] as ObjectChunk;
    const profile = getObjectFieldRef(user, "profile")
      .value as CompositeNullChunk;

    expect(profile.kind).toBe(ValueKind.CompositeNull);
    expect(user.missingFields).toBeNull();
    expect(user.partialFields).toBeNull();
  });

  it("handles custom object keys", () => {
    const operation = createTestOperation(`
      {
        user {
          __typename
          customId
          name
        }
      }
    `);
    const data: any = {
      user: {
        __typename: "User",
        customId: "user-custom-1",
        name: "Alice",
      },
    };

    // Custom objectKey function
    const customEnv: ForestEnv = {
      objectKey: (obj: any) => obj.customId,
    };
    const indexedTree = indexTree(customEnv, operation, {
      data: createSourceObject(data),
    });

    expect(indexedTree.rootNodeKey).toBe("ROOT_QUERY");
    expect(indexedTree.nodes.size).toBe(2); // ROOT_QUERY, user-custom-1
    expect(indexedTree.dataMap.size).toBe(2);
    expect(indexedTree.typeMap.size).toBe(2);

    const root = indexedTree.nodes.get("ROOT_QUERY");
    const user = indexedTree.nodes.get("user-custom-1");
    const userRef = indexedTree.dataMap.get(data.user);

    verifyObjectChunk(user, "user-custom-1", data.user);
    verifyObjectFieldRef(userRef, user, root, "user");
    verifyTypeChunks("User", indexedTree.typeMap.get("User"), [user?.[0]]);
  });

  it("handles invalid data gracefully", () => {
    const operation = createTestOperation(`
      {
        user(id: "user1") {
          __typename
          id
          profile {
            __typename
            bio
          }
        }
      }
    `);
    const data = createSourceObject({
      user: {
        __typename: "User",
        id: "user1",
        profile: "invalid_profile_data", // Invalid data
      },
    });
    expect(() => {
      indexTree(defaultEnv, operation, { data });
    }).toThrowError("Invariant violation");
  });
});

describe(indexObject, () => {
  it("indexes detached objects", () => {
    const operation = createTestOperation(`
      {
        user(id: "user1") {
          __typename
          id
          name
          profile {
            __typename
            id
            bio
            social { githubUrl, linkedinUrl }
          }
        }
      }
    `);
    const data: any = {
      user: {
        __typename: "User",
        id: "user1",
        name: "Alice",
        profile: {
          __typename: "Profile",
          id: "profile1",
          bio: "Hello world!",
          social: {
            githubUrl: "https://github.com/example",
            linkedinUrl: "https://linkedin.com/example",
          },
        },
      },
    };
    const userField = getFieldInfo(operation.possibleSelections, ["user"]);

    const indexedObject = indexObject(
      defaultEnv,
      operation,
      data.user,
      userField.selection!,
    );

    const user = indexedObject.nodes.get("user1");
    const profile = indexedObject.nodes.get("profile1");
    const social = getEmbeddedObjectChunk(profile, "social");

    const userRef = indexedObject.dataMap.get(data.user);
    const profileRef = indexedObject.dataMap.get(data.user.profile);
    const socialRef = indexedObject.dataMap.get(data.user.profile.social);

    expect(indexedObject.detached).toBe(true);
    expect(indexedObject.dataMap.size).toBe(3);
    expect(indexedObject.nodes.size).toBe(2);
    expect(indexedObject.value).toBe(user?.[0]);
    expect(indexedObject).toBe(userRef);

    verifyObjectChunk(user, "user1", data.user);
    verifyObjectChunk(profile, "profile1", data.user.profile);
    verifyObjectChunk(social, false, data.user.profile.social);

    expect(profile?.[0]).toBe(getEmbeddedObjectChunk(user, "profile"));
    expect(social).toBe(getEmbeddedObjectChunk(profile, "social"));

    // Verify other references
    //   (root reference was verified via indexedObject assertions)
    verifyObjectFieldRef(profileRef, profile, user, "profile");
    verifyObjectFieldRef(socialRef, social, profile, "social");
  });
});

function getObjectFieldRef(
  chunk: ObjectChunk | ObjectChunk[] | undefined,
  dataKey: string,
): ObjectFieldReference {
  if (Array.isArray(chunk)) {
    assert(chunk.length === 1);
    chunk = chunk[0];
  }
  const ref = chunk?.fieldChunks.get(dataKey);
  assert(ref);
  return ref;
}

function getEmbeddedObjectChunk(
  chunk: ObjectChunk | ObjectChunk[] | undefined,
  dataKey: string,
): ObjectChunk {
  const ref = getObjectFieldRef(chunk, dataKey);
  assert(isObjectValue(ref.value));
  return ref.value;
}

function getEmbeddedListChunk(
  chunk: ObjectChunk | ObjectChunk[] | undefined,
  dataKey: string,
): CompositeListChunk {
  const ref = getObjectFieldRef(chunk, dataKey);
  assert(isCompositeListValue(ref.value));
  return ref.value;
}

function verifyTypeChunks(
  typeName: string,
  actualTypeChunks: ObjectChunk[] | undefined,
  expectedTypeChunks: (ObjectChunk | undefined)[],
) {
  assert(Array.isArray(actualTypeChunks));
  expect(actualTypeChunks.length).toEqual(expectedTypeChunks.length);

  for (let i = 0; i < expectedTypeChunks.length; i++) {
    const expectedChunk = expectedTypeChunks[i];
    assert(expectedChunk !== undefined);

    expect(actualTypeChunks[i].type).toBe(typeName);
    expect(actualTypeChunks[i]).toBe(expectedChunk);
  }
}

function verifyObjectChunk(
  obj: ObjectChunk | ObjectChunk[] | undefined,
  expectedKey: string | false,
  expectedData: { [key: string]: unknown },
) {
  if (Array.isArray(obj)) {
    expect(obj.length).toBe(1);
    obj = obj[0];
  }
  const rootTypes = new Map<string | false, string>(
    Object.entries({
      ROOT_QUERY: "Query",
      ROOT_MUTATION: "Mutation",
      ROOT_SUBSCRIPTION: "Subscription",
    }),
  );
  const expectedType =
    expectedData["__typename"] ?? rootTypes.get(expectedKey) ?? false;

  expect(obj?.kind).toBe(ValueKind.Object);
  expect(obj?.key).toBe(expectedKey);
  expect(obj?.data).toBe(expectedData);
  expect(obj?.type).toBe(expectedType);
  expect(obj?.isAggregate).toBe(false);
}

function verifyListChunk(
  obj: CompositeListChunk | CompositeListChunk[] | undefined,
  expectedData: object[],
) {
  if (Array.isArray(obj)) {
    expect(obj.length).toBe(1);
    obj = obj[0];
  }
  expect(obj?.kind).toBe(ValueKind.CompositeList);
  expect(obj?.data).toBe(expectedData);
  expect(obj?.itemChunks.length).toBe(expectedData.length);
  expect(obj?.isAggregate).toBe(false);
}

function verifyRootRef(
  ref: GraphChunkReference | undefined,
  expectValue: ObjectChunk | ObjectChunk[] | undefined,
  expectDetached = false,
) {
  assert(expectValue);
  expect(ref).toEqual({
    parent: null,
    value: Array.isArray(expectValue) ? expectValue[0] : expectValue,
    detached: expectDetached,
  });
}

function verifyObjectFieldRef(
  ref: GraphChunkReference | undefined,
  expectValue: CompositeValueChunk | CompositeValueChunk[] | undefined,
  expectParent: ObjectChunk | ObjectChunk[] | undefined,
  field: string,
) {
  assert(expectValue && expectParent);
  const parent = Array.isArray(expectParent) ? expectParent[0] : expectParent;

  expect(ref).toEqual({
    value: Array.isArray(expectValue) ? expectValue[0] : expectValue,
    parent,
    field: getFieldInfo(parent.selection, [field]),
  });
}

function verifyListItemRef(
  ref: GraphChunkReference | undefined,
  expectValue: CompositeValueChunk | CompositeValueChunk[] | undefined,
  expectParent: CompositeListChunk | CompositeListChunk[] | undefined,
  index: number,
) {
  assert(expectValue && expectParent);
  const parent = Array.isArray(expectParent) ? expectParent[0] : expectParent;

  expect(ref).toEqual({
    value: Array.isArray(expectValue) ? expectValue[0] : expectValue,
    parent,
    index,
  });
}

const defaultEnv: ForestEnv = {
  objectKey: (obj: any) => obj.id,
};
