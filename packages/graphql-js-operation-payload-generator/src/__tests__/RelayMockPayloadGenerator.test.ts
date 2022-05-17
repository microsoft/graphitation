/**
 * Copyright (c) Facebook, Inc. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * https://github.com/facebook/relay/blob/b8d2694dbef01f003c4452fa0364f9a7f20245ee/LICENSE
 */

/**
 * NOTE: This file's name is prefixed with 'Relay' so we can wholesale copy it from upstream.
 * Current version: https://github.com/facebook/relay/blob/b8d2694dbef01f003c4452fa0364f9a7f20245ee/packages/relay-test-utils/RelayMockPayloadGenerator.js
 */

import {
  buildSchema,
  DocumentNode,
  print as printGraphQLDocument,
} from "graphql";
import { readFileSync } from "fs";

import { graphql } from "@graphitation/graphql-js-tag";
import { generate, MockResolvers } from "../executor-version";

const {
  FIXTURE_TAG,
} = require("relay-test-utils-internal/lib/generateTestsFromFixtures");

const schema = buildSchema(
  readFileSync(
    require.resolve("relay-test-utils-internal/lib/testschema.graphql"),
    "utf8",
  ),
);

function testGeneratedData(
  documentNode: DocumentNode,
  mockResolvers?: MockResolvers | null,
): void {
  const payload = generate(
    { schema, request: { node: documentNode, variables: {} } },
    mockResolvers,
  );
  expect({
    [FIXTURE_TAG]: true,
    input: printGraphQLDocument(documentNode),
    output: JSON.stringify(payload, null, 2),
  }).toMatchSnapshot();
}

test("generate mock for simple fragment", () => {
  const fragment = graphql`
    fragment RelayMockPayloadGeneratorTestFragment on User {
      id
      name
      profile_picture {
        uri
        width
        height
      }
    }
  `;
  testGeneratedData(graphql`
    query RelayMockPayloadGeneratorTest1Query {
      node(id: "my-id") {
        __typename
        ...RelayMockPayloadGeneratorTestFragment
        id
      }
    }
    ${fragment}
  `);
});

test("generate mock with abstract inline fragment", () => {
  const fragment = graphql`
    fragment RelayMockPayloadGeneratorTest1Fragment on Actor {
      id
      # abstract inline fragment
      ... on Named {
        name
      }
      ... on User {
        firstName
        lastName
      }
      ... on Page {
        websites
      }
    }
  `;
  testGeneratedData(graphql`
    query RelayMockPayloadGeneratorTest2Query {
      viewer {
        actor {
          __typename
          # abstract fragment spread
          ...RelayMockPayloadGeneratorTest1Fragment
          id
        }
      }
    }
    ${fragment}
  `);
});

test("generate mock with inline fragment", () => {
  const fragment = graphql`
    fragment RelayMockPayloadGeneratorTest2Fragment on User {
      id
      name
      author {
        id
        name
      }
      ... on User {
        author {
          authorID: id
          username
        }
      }
      ... on User @include(if: $condition) {
        author {
          myId: id
          myUsername: username
          emailAddresses
          birthdate {
            day
            month
            year
          }
        }
      }
    }
  `;
  testGeneratedData(graphql`
    query RelayMockPayloadGeneratorTest3Query($condition: Boolean) {
      node(id: "my-id") {
        __typename
        ...RelayMockPayloadGeneratorTest2Fragment
        id
      }
    }
    ${fragment}
  `);
});

test("generate mock with condition (and other complications)", () => {
  const fragment = graphql`
    fragment RelayMockPayloadGeneratorTest3Fragment on User {
      id
      name
      # TODO: RelayMockPayloadGenerator returns a different value for this scalar:
      # "customId": "<User-mock-id-2>"
      customId: id
      profile_picture @include(if: $showProfilePicture) {
        uri
      }
      birthdate @skip(if: $hideBirthday) {
        year
        month @include(if: $showBirthdayMonth)
      }
      author {
        name
        id
      }
      ... on User @skip(if: $hideAuthorUsername) {
        author {
          authorID: id
          objectType: __typename
          username
        }
      }
      allPhones {
        phoneNumber {
          displayNumber
        }
      }
      # TODO: RelayMockPayloadGenerator returns incorrect value for this list:
      # "emailAddresses": "<mock-value-for-field-"emailAddresses">"
      emailAddresses @__clientField(handle: "customName")
      backgroundImage @__clientField(handle: "customBackground") {
        uri
      }
    }
  `;
  testGeneratedData(graphql`
    query RelayMockPayloadGeneratorTest4Query(
      $showProfilePicture: Boolean
      $hideBirthday: Boolean
      $showBirthdayMonth: Boolean
      $hideAuthorUsername: Boolean
    ) {
      node(id: "my-id") {
        __typename
        ...RelayMockPayloadGeneratorTest3Fragment
        id
      }
    }
    ${fragment}
  `);
});

test("generate mock with connection", () => {
  const fragment1 = graphql`
    fragment RelayMockPayloadGeneratorTest4Fragment on User {
      name
      username
      # TODO: RelayMockPayloadGenerator returns incorrect value for this list:
      # "emailAddresses": "<mock-value-for-field-"emailAddresses">"
      emailAddresses
    }
  `;
  const fragment2 = graphql`
    fragment RelayMockPayloadGeneratorTest5Fragment on Page {
      actor {
        __typename
        ... on User {
          id
          myType: __typename
          myName: name
          name
          friends(first: $first) @connection(key: "FriendsConnection_friends") {
            edges {
              cursor
              node {
                id
                ...RelayMockPayloadGeneratorTest4Fragment
                  @skip(if: $skipUserInConnection)
                __typename
              }
            }
            pageInfo {
              endCursor
              # TODO: RelayMockPayloadGenerator returns incorrect value for this boolean scalar:
              # "hasNextPage": "<mock-value-for-field-"hasNextPage">"
              hasNextPage
            }
          }
          ...RelayMockPayloadGeneratorTest4Fragment
        }
      }
    }
    ${fragment1}
  `;
  testGeneratedData(graphql`
    query RelayMockPayloadGeneratorTest5Query(
      $first: Int
      $skipUserInConnection: Boolean
    ) {
      node(id: "my-id") {
        __typename
        id
        ...RelayMockPayloadGeneratorTest5Fragment
      }
    }
    ${fragment2}
  `);
});

test("generate basic mock data", () => {
  const fragment = graphql`
    fragment RelayMockPayloadGeneratorTest6Fragment on User {
      id
      name
      author {
        id
        name
      }
    }
  `;
  testGeneratedData(
    graphql`
      query RelayMockPayloadGeneratorTest6Query {
        node(id: "my-id") {
          __typename
          ...RelayMockPayloadGeneratorTest6Fragment
          id
        }
      }
      ${fragment}
    `,
    null, // Mock Resolvers
  );
});

test("generate mock using custom mock functions", () => {
  const fragment = graphql`
    fragment RelayMockPayloadGeneratorTest7Fragment on User {
      id
      name
      profile_picture {
        uri
      }
    }
  `;
  testGeneratedData(
    graphql`
      query RelayMockPayloadGeneratorTest7Query {
        node(id: "my-id") {
          __typename
          ...RelayMockPayloadGeneratorTest7Fragment
          id
        }
      }
      ${fragment}
    `,
    {
      ID(context, generateId) {
        return `my-id-${String(generateId() + 1000)}`;
      },
      String({ name }) {
        if (name === "uri") {
          return "http://my-uri";
        }
      },
    },
  );
});

test("generate mock using custom mock functions for object type", () => {
  const fragment = graphql`
    fragment RelayMockPayloadGeneratorTest8Fragment on Page {
      actor {
        __typename
        id
        name
      }
      backgroundImage {
        width
        uri
      }
    }
  `;
  testGeneratedData(
    graphql`
      query RelayMockPayloadGeneratorTest8Query {
        node(id: "my-id") {
          __typename
          ...RelayMockPayloadGeneratorTest8Fragment
          id
        }
      }
      ${fragment}
    `,
    {
      Image: () => {
        return {
          width: 200,
          height: 100,
          uri: "http://my-image",
        };
      },
    },
  );
});

// NOTE: The snapshot here is different because we can better
// resolve the possible concrete type that an interface can implement.
test("generate mock for objects without concrete type", () => {
  const fragment = graphql`
    fragment RelayMockPayloadGeneratorTest9Fragment on Page {
      actor {
        __typename
        id
        name
      }
    }
  `;
  testGeneratedData(
    graphql`
      query RelayMockPayloadGeneratorTest9Query {
        node(id: "my-id") {
          __typename
          ...RelayMockPayloadGeneratorTest9Fragment
          id
        }
      }
      ${fragment}
    `,
    {
      Actor: () => {
        return {
          __typename: "User",
          name: "Mark",
        };
      },
    },
  );
});

test("generate mock using custom mock functions for object type (multiple object)", () => {
  const fragment = graphql`
    fragment RelayMockPayloadGeneratorTest10Fragment on User {
      name
      actor {
        __typename
        ... on User {
          id
          name
          profile_picture {
            uri
            height
          }
        }
        id
      }
      profile_picture {
        uri
      }
    }
  `;
  testGeneratedData(
    graphql`
      query RelayMockPayloadGeneratorTest10Query {
        node(id: "my-id") {
          __typename
          id
          ...RelayMockPayloadGeneratorTest10Fragment
        }
      }
      ${fragment}
    `,
    {
      User: () => {
        return {
          name: "My user name",
        };
      },
      Image: (...args) => {
        return {
          width: 200,
          height: 100,
          uri: "http://my-image",
        };
      },
    },
  );
});

test("check context in the mock resolver", () => {
  let checkContext;
  const fragment = graphql`
    fragment RelayMockPayloadGeneratorTest11Fragment on Viewer {
      actor {
        __typename
        ... on User {
          id
          name
          profile_picture {
            uri
            height
          }
        }
        id
      }
    }
  `;
  testGeneratedData(
    graphql`
      query RelayMockPayloadGeneratorTest11Query {
        viewer {
          ...RelayMockPayloadGeneratorTest11Fragment
        }
      }
      ${fragment}
    `,
    {
      Image: (context) => {
        checkContext = context;
        return {
          width: 200,
          height: 100,
          uri: "http://my-image",
        };
      },
    },
  );
  expect(checkContext).toMatchInlineSnapshot(`
     Object {
       "alias": null,
       "args": Object {},
       "name": "profile_picture",
       "parentType": null,
       "path": Array [
         "viewer",
         "actor",
         "profile_picture",
       ],
     }
   `);
});

test("generate mock with manual mock for objects", () => {
  const fragment = graphql`
    fragment RelayMockPayloadGeneratorTest12Fragment on Page {
      id
      name
      body {
        text
      }
      myTown: hometown {
        id
        name
        url
        feedback {
          comments(first: 10) {
            edges {
              cursor
              comment: node {
                id
                message {
                  text
                }
                likeSentence {
                  text
                }
              }
            }
            pageInfo {
              startCursor
            }
          }
          id
        }
      }
    }
  `;
  testGeneratedData(
    graphql`
      query RelayMockPayloadGeneratorTest12Query {
        node(id: "my-id") {
          __typename
          ...RelayMockPayloadGeneratorTest12Fragment
          id
        }
      }
      ${fragment}
    `,
    {
      Page: (context, generateId) => {
        return {
          id: `page-id-${generateId()}`,
          name: context.name === "hometown" ? "My Hometown" : "My Page",
          body: {
            text: "My Text",
          },
          url: `http://${
            Array.isArray(context.path) ? context.path.join("-") : ""
          }`,
        };
      },
      Comment: (context) => {
        return {
          message: {
            text: `Comment text: ${
              Array.isArray(context.path) ? context.path.join(">") : ""
            }`,
          },
        };
      },
    },
  );
});

test("generate mock with multiple spreads", () => {
  const fragment = graphql`
    fragment RelayMockPayloadGeneratorTest13Fragment on Viewer {
      actor {
        __typename
        ... on User {
          id
          name
          # TODO: RelayMockPayloadGenerator returns no enum value here because it requires
          # @relay_test_operation. If we want to match that, we should require the directive too.
          traits
          profile_picture {
            uri
            # TODO: RelayMockPayloadGenerator returns a different value for this scalar:
            # "height": "<mock-value-for-field-"height">"
            height
          }
        }
        ... on Page {
          id
          name
          websites
        }
        id
      }
    }
  `;
  testGeneratedData(graphql`
    query RelayMockPayloadGeneratorTest13Query {
      viewer {
        ...RelayMockPayloadGeneratorTest13Fragment
      }
    }
    ${fragment}
  `);
});

test("generate mock and verify arguments in the context", () => {
  const fragment = graphql`
    fragment RelayMockPayloadGeneratorTest14Fragment on User {
      id
      name
      smallImage: profile_picture(scale: $smallScale) {
        uri
      }
      bigImage: profile_picture(scale: $bigScale) {
        uri
      }
    }
  `;
  testGeneratedData(
    graphql`
      query RelayMockPayloadGeneratorTest14Query(
        $smallScale: Int = 1
        $bigScale: Int = 100
      ) {
        node(id: "my-id") {
          __typename
          ...RelayMockPayloadGeneratorTest14Fragment
          id
        }
      }
      ${fragment}
    `,
    {
      Image: (context) => {
        if (context?.args?.scale === 100) {
          return {
            uri: "big image",
          };
        } else if (context?.args?.scale === 1) {
          return {
            uri: "small image",
          };
        }
      },
    },
  );
});

// TODO: Check this with a real test, as these should be compiled out, I think.
xtest("generate mock for fragment with @argumentsDefinition", () => {
  const fragment = graphql`
    fragment RelayMockPayloadGeneratorTest15Fragment on User
    @argumentDefinitions(withName: { type: "Boolean!" }) {
      id
      name @include(if: $withName)
      profile_picture(scale: $scale) {
        uri
        width
        height
      }
    }
  `;
  testGeneratedData(
    graphql`
      query RelayMockPayloadGeneratorTest15Query($scale: Int = 1) {
        node(id: "my-id") {
          ...RelayMockPayloadGeneratorTest15Fragment @arguments(withName: true)
        }
      }
      ${fragment}
    `,
    {
      Image() {
        return {
          width: 42,
          height: 42,
        };
      },
    },
  );
});

xtest("generate mock for plural fragment", () => {
  graphql`
    fragment RelayMockPayloadGeneratorTest16Fragment on Comment
    @relay(plural: true) {
      id
      body {
        text
      }
    }
  `;
  testGeneratedData(graphql`
    query RelayMockPayloadGeneratorTest16Query {
      nodes {
        ...RelayMockPayloadGeneratorTest16Fragment
      }
    }
  `);
});

test("generate mock for multiple fragment spreads", () => {
  const fragment1 = graphql`
    fragment RelayMockPayloadGeneratorTest17Fragment on Page {
      id
      pageName: name
    }
  `;
  const fragment2 = graphql`
    fragment RelayMockPayloadGeneratorTest18Fragment on User {
      id
      name
      username
    }
  `;
  const fragment3 = graphql`
    fragment RelayMockPayloadGeneratorTest19Fragment on User {
      ...RelayMockPayloadGeneratorTest18Fragment
      profile_picture {
        uri
      }
    }
    ${fragment2}
  `;
  const fragment4 = graphql`
    fragment RelayMockPayloadGeneratorTest20Fragment on User {
      body {
        text
      }
      actor {
        __typename
        name
        id
      }
      myActor: actor {
        __typename
        ...RelayMockPayloadGeneratorTest17Fragment
      }
      ...RelayMockPayloadGeneratorTest18Fragment
      ...RelayMockPayloadGeneratorTest19Fragment
    }
    ${fragment1}
    ${fragment2}
    ${fragment3}
  `;
  testGeneratedData(graphql`
    query RelayMockPayloadGeneratorTest17Query {
      node(id: "my-id") {
        __typename
        id
        ...RelayMockPayloadGeneratorTest20Fragment
      }
    }
    ${fragment4}
  `);
});

xtest("generate mock for with directives and handlers", () => {
  graphql`
    fragment RelayMockPayloadGeneratorTest21Fragment on User {
      birthdate {
        month
      }
    }
  `;
  graphql`
    fragment RelayMockPayloadGeneratorTest22Fragment on User
    @argumentDefinitions(condition: { type: "Boolean!" }) {
      id
      name
      myActor: actor {
        id
        name
      }
      customName: name
      friends(first: $first) @connection(key: "User_friends") {
        edges {
          node {
            id
            name
          }
        }
        myPageInfo: pageInfo {
          endCursor
          hasNextPage
        }
      }
      profile_picture {
        uri
      }
      profilePicture(preset: $picturePreset) @include(if: $condition) {
        uri
      }
      ...RelayMockPayloadGeneratorTest21Fragment
      actor {
        ... on User {
          id
          userName: name
          name: username
          profilePicture(size: 1) {
            uri
            width
            height
          }
          feedback {
            comments {
              edges {
                node {
                  ...RelayMockPayloadGeneratorTest23Fragment
                    @defer(if: $RELAY_INCREMENTAL_DELIVERY, label: "DeferLabel")
                }
              }
            }
          }
        }
        ... on Page {
          id
          pageName: name
        }
        username @__clientField(handle: "MyUserName")
      }
    }
  `;
  graphql`
    fragment RelayMockPayloadGeneratorTest23Fragment on Comment {
      body {
        text
      }
    }
  `;
  testGeneratedData(graphql`
    query RelayMockPayloadGeneratorTest18Query(
      $first: Int = 10
      $picturePreset: PhotoSize
      $RELAY_INCREMENTAL_DELIVERY: Boolean = false
    ) {
      node(id: "my-id") {
        ...RelayMockPayloadGeneratorTest22Fragment @arguments(condition: true)
      }
    }
  `);
});

test("should return `null` for selection if that is specified in default values", () => {
  const fragment1 = graphql`
    fragment RelayMockPayloadGeneratorTest24Fragment on User {
      id
      name
    }
  `;
  const fragment3 = graphql`
    fragment RelayMockPayloadGeneratorTest26Fragment on Image {
      uri
      # TODO: RelayMockPayloadGenerator returns a different value for these scalars:
      # "width": "<mock-value-for-field-"width">"
      # "height": "<mock-value-for-field-"height">"
      width
      height
    }
  `;
  const fragment2 = graphql`
    fragment RelayMockPayloadGeneratorTest25Fragment on User {
      id
      name
      profile_picture {
        ...RelayMockPayloadGeneratorTest26Fragment
      }
    }
    ${fragment3}
  `;
  const fragment4 = graphql`
    fragment RelayMockPayloadGeneratorTest27Fragment on User {
      body {
        text
      }
      actor {
        name
        id
      }
      myActor: actor {
        __typename
        ...RelayMockPayloadGeneratorTest24Fragment
      }
      ...RelayMockPayloadGeneratorTest25Fragment
    }
    ${fragment1}
    ${fragment2}
  `;
  testGeneratedData(
    graphql`
      query RelayMockPayloadGeneratorTest19Query {
        node(id: "my-id") {
          __typename
          id
          ...RelayMockPayloadGeneratorTest27Fragment
        }
      }
      ${fragment4}
    `,
    {
      User() {
        return {
          actor: null,
        };
      },
    },
  );
});

describe("with @relay_test_operation", () => {
  xtest("generate mock for simple query", () => {
    testGeneratedData(graphql`
      query RelayMockPayloadGeneratorTest20Query @relay_test_operation {
        me {
          id
          name
          emailAddresses
          profile_picture(scale: 1) {
            uri
            width
            height
          }
        }
      }
    `);
  });

  xtest("generate mock for simple fragment", () => {
    graphql`
      fragment RelayMockPayloadGeneratorTest28Fragment on User {
        id
        name
        profile_picture {
          uri
          width
          height
        }
      }
    `;
    testGeneratedData(graphql`
      query RelayMockPayloadGeneratorTest21Query @relay_test_operation {
        node(id: "my-id") {
          ...RelayMockPayloadGeneratorTest28Fragment
        }
      }
    `);
  });

  test("generate mock with Enums", () => {
    testGeneratedData(graphql`
      query RelayMockPayloadGeneratorTest22Query @relay_test_operation {
        node(id: "my-id") {
          __typename
          ... on User {
            id
            name
            environment
          }
          id
        }
      }
    `);
  });

  xtest("generate mock with Mock Resolvers for Concrete Type", () => {
    testGeneratedData(
      graphql`
        query RelayMockPayloadGeneratorTest23Query @relay_test_operation {
          node(id: "my-id") {
            ... on User {
              id
              name
            }
          }
        }
      `,
      {
        User() {
          return {
            id: "my-id",
            name: "my-name",
          };
        },
      },
    );
  });

  xtest("generate mock with Mock Resolvers for Interface Type", () => {
    testGeneratedData(
      graphql`
        query RelayMockPayloadGeneratorTest24Query @relay_test_operation {
          node(id: "my-id") {
            ... on User {
              id
              name
            }
          }
        }
      `,
      {
        Node() {
          return {
            id: "my-id",
            name: "my-name",
          };
        },
      },
    );
  });

  // Added more fragments here to test resolving across fragment definition boundaries.
  xtest("generate mock with Mock Resolvers for Interface Type with multiple fragment spreads", () => {
    const fragment1 = graphql`
      fragment RelayMockPayloadGeneratorTest25Fragment1 on Page {
        id
        pageName: name
      }
    `;
    const fragment2 = graphql`
      fragment RelayMockPayloadGeneratorTest25Fragment2 on Node {
        __typename
        ... on User {
          id
          name
        }
        ...RelayMockPayloadGeneratorTest25Fragment1
        id
      }
      ${fragment1}
    `;
    testGeneratedData(
      graphql`
        query RelayMockPayloadGeneratorTest25Query {
          node(id: "my-id") {
            ...RelayMockPayloadGeneratorTest25Fragment2
          }
        }
        ${fragment2}
      `,
      {
        Node() {
          return {
            __typename: "Page",
            id: "my-page-id",
            name: "my-page-name",
          };
        },
      },
    );
  });

  xtest("generate mock with Mock Resolvers for Interface Type with multiple fragments", () => {
    graphql`
      fragment RelayMockPayloadGeneratorTest29Fragment on Page {
        id
        pageName: name
      }
    `;

    graphql`
      fragment RelayMockPayloadGeneratorTest30Fragment on User {
        id
        userName: name
      }
    `;
    testGeneratedData(
      graphql`
        query RelayMockPayloadGeneratorTest26Query @relay_test_operation {
          node(id: "my-id") {
            ...RelayMockPayloadGeneratorTest29Fragment
            ...RelayMockPayloadGeneratorTest30Fragment
          }
        }
      `,
      {
        Node() {
          return {
            __typename: "Page",
            id: "my-page-id",
            name: "my-page-name",
          };
        },
      },
    );
  });

  xtest("generate mock with Mock Resolvers for Interface Type with Concrete Type mock resolver", () => {
    testGeneratedData(
      graphql`
        query RelayMockPayloadGeneratorTest27Query @relay_test_operation {
          node(id: "my-id") {
            ... on User {
              id
              name
            }
          }
        }
      `,
      {
        User() {
          return {
            id: "my-user-id",
            name: "my-user-name",
          };
        },
      },
    );
  });

  xtest("generate mock with Mock Resolvers for Scalar field as null", () => {
    testGeneratedData(
      graphql`
        query RelayMockPayloadGeneratorTest28Query @relay_test_operation {
          node(id: "my-id") {
            ... on User {
              id
              name
            }
          }
        }
      `,
      {
        User() {
          return {
            id: "my-user-id",
            name: null,
          };
        },
      },
    );
  });

  xtest("generate mock with multiple items in arrays for scalar field", () => {
    testGeneratedData(
      graphql`
        query RelayMockPayloadGeneratorTest29Query @relay_test_operation {
          node(id: "my-id") {
            ... on User {
              id
              emailAddresses
            }
          }
        }
      `,
      {
        User(_, generateId) {
          return {
            emailAddresses: Array(5)
              .fill(null)
              .map((__, idx) => `mock_email-${idx}-${generateId()}@fb.com`),
          };
        },
      },
    );
  });

  xtest("generate mock with empty array for scalar field ", () => {
    testGeneratedData(
      graphql`
        query RelayMockPayloadGeneratorTest30Query @relay_test_operation {
          node(id: "my-id") {
            ... on User {
              id
              emailAddresses
            }
          }
        }
      `,
      {
        User(_, generateId) {
          return {
            emailAddresses: [],
          };
        },
      },
    );
  });

  xtest("generate mock with multiple items in arrays for linked field with default data", () => {
    testGeneratedData(
      graphql`
        query RelayMockPayloadGeneratorTest31Query @relay_test_operation {
          node(id: "my-id") {
            ... on User {
              id
              friends {
                edges {
                  node {
                    id
                    name
                    profile_picture {
                      uri
                      width
                      height
                    }
                  }
                }
              }
            }
          }
        }
      `,
      {
        FriendsConnection(_, generateId) {
          return {
            edges: Array(5).fill(null),
          };
        },
      },
    );
  });

  xtest("generate mock with multiple items in arrays including null", () => {
    testGeneratedData(
      graphql`
        query RelayMockPayloadGeneratorTest32Query @relay_test_operation {
          node(id: "my-id") {
            ... on User {
              id
              friends {
                edges {
                  node {
                    id
                    name
                    profile_picture {
                      uri
                      width
                      height
                    }
                  }
                }
              }
            }
          }
        }
      `,
      {
        FriendsConnection(_, generateId) {
          return {
            edges: [null, undefined],
          };
        },
      },
    );
  });

  xtest("generate mock with multiple items in arrays for linked field with custom data", () => {
    testGeneratedData(
      graphql`
        query RelayMockPayloadGeneratorTest33Query @relay_test_operation {
          node(id: "my-id") {
            ... on User {
              id
              friends {
                edges {
                  node {
                    id
                    name
                    profile_picture {
                      uri
                      width
                      height
                    }
                  }
                }
              }
            }
          }
        }
      `,
      {
        FriendsConnection(_, generateId) {
          return {
            edges: [
              {
                node: {
                  id: `friend-id-${generateId()}`,
                  name: "Alice",
                },
              },
              {
                node: {
                  id: `friend-id-${generateId()}`,
                  name: "Bob",
                },
              },
            ],
          };
        },
      },
    );
  });

  xtest("generate mock with multiple items in arrays for linked field with custom data and additional mock resolver", () => {
    testGeneratedData(
      graphql`
        query RelayMockPayloadGeneratorTest34Query @relay_test_operation {
          node(id: "my-id") {
            ... on User {
              id
              friends {
                edges {
                  node {
                    id
                    name
                    profile_picture {
                      uri
                      width
                      height
                    }
                  }
                }
              }
            }
          }
        }
      `,
      {
        Image(_, generateId) {
          return {
            uri: `/image-url-${generateId()}.jpg`,
          };
        },
        FriendsConnection() {
          return {
            edges: [
              undefined,
              {
                node: {
                  name: "Bob with Image",
                },
              },
            ],
          };
        },
      },
    );
  });

  xtest("generate mock data with mock resolver for ID that may return `undefined`", () => {
    testGeneratedData(
      graphql`
        query RelayMockPayloadGeneratorTest35Query @relay_test_operation {
          node(id: "my-id") {
            ... on User {
              id
              friends {
                edges {
                  node {
                    id
                    name
                  }
                }
              }
            }
          }
        }
      `,
      {
        ID(context) {
          if (context.path?.join(".") === "node.id") {
            return "this-is-my-id";
          }
        },
        FriendsConnection() {
          return {
            // IDs for those edges should be generated by default mock
            // resolver for ID type
            edges: Array(2).fill(null),
          };
        },
      },
    );
  });

  xtest("generate mock with default value for object in plural field", () => {
    testGeneratedData(
      graphql`
        query RelayMockPayloadGeneratorTest36Query @relay_test_operation {
          node(id: "my-id") {
            ... on User {
              id
              friends {
                edges {
                  node {
                    id
                    name
                  }
                }
              }
            }
          }
        }
      `,
      {
        FriendsEdge() {
          return {
            node: {
              name: "Alice",
            },
          };
        },
      },
    );
  });

  xtest("generate mock with default value for plural field and its object", () => {
    testGeneratedData(
      graphql`
        query RelayMockPayloadGeneratorTest37Query @relay_test_operation {
          node(id: "my-id") {
            ... on User {
              id
              friends {
                edges {
                  node {
                    id
                    name
                  }
                }
              }
            }
          }
        }
      `,
      {
        FriendsConnection() {
          return {
            edges: Array(5).fill(null),
          };
        },
        FriendsEdge() {
          return {
            node: {
              name: "Alice",
            },
          };
        },
      },
    );
  });

  xtest("generate mock with default value for scalar plural field", () => {
    testGeneratedData(
      graphql`
        query RelayMockPayloadGeneratorTest38Query @relay_test_operation {
          node(id: "my-id") {
            ... on User {
              id
              emailAddresses
            }
          }
        }
      `,
      {
        User(context) {
          return {
            emailAddresses: "my@email.com",
          };
        },
      },
    );
  });

  xtest("generate mock for enum with different case should be OK", () => {
    testGeneratedData(
      graphql`
        query RelayMockPayloadGeneratorTest39Query @relay_test_operation {
          node(id: "my-id") {
            ... on User {
              id
              environment
            }
          }
        }
      `,
      {
        User(context) {
          return {
            environment: "Web",
          };
        },
      },
    );
  });

  xtest("generate mock for enum in arrays", () => {
    testGeneratedData(
      graphql`
        query RelayMockPayloadGeneratorTest40Query @relay_test_operation {
          node(id: "my-id") {
            ... on User {
              id
              traits
            }
          }
        }
      `,
      {
        User(context) {
          return {
            traits: ["CHEERFUL", "DERISIVE"],
          };
        },
      },
    );
  });

  xtest("generate mock with invalid value for enum", () => {
    expect(() => {
      testGeneratedData(
        graphql`
          query RelayMockPayloadGeneratorTest41Query @relay_test_operation {
            node(id: "my-id") {
              ... on User {
                id
                environment
              }
            }
          }
        `,
        {
          User(context) {
            return {
              environment: "INVALID_VALUE",
            };
          },
        },
      );
    }).toThrow(
      'RelayMockPayloadGenerator: Invalid value "INVALID_VALUE" provided for enum field',
    );
  });

  xtest("generate mock with null for enum", () => {
    testGeneratedData(
      graphql`
        query RelayMockPayloadGeneratorTest42Query @relay_test_operation {
          node(id: "my-id") {
            ... on User {
              id
              environment
            }
          }
        }
      `,
      {
        User(context) {
          return {
            environment: null,
          };
        },
      },
    );
  });

  xtest("generate mock for client extensions", () => {
    testGeneratedData(
      graphql`
        query RelayMockPayloadGeneratorTest43Query @relay_test_operation {
          node(id: "my-id") {
            ... on User {
              id
              client_name
              client_code
            }
          }
        }
      `,
    );
  });

  xtest("should generate data for @module", () => {
    graphql`
      fragment RelayMockPayloadGeneratorTestNameRendererFragment on User {
        id
        nameRenderer {
          ...RelayMockPayloadGeneratorTestMarkdownUserNameRenderer_name
            @module(name: "MarkdownUserNameRenderer.react")
        }
      }
    `;
    graphql`
      fragment RelayMockPayloadGeneratorTestMarkdownUserNameRenderer_name on MarkdownUserNameRenderer {
        markdown
        data {
          markup
        }
      }
    `;
    testGeneratedData(
      graphql`
        query RelayMockPayloadGeneratorTest44Query @relay_test_operation {
          node(id: "my-id") {
            ...RelayMockPayloadGeneratorTestNameRendererFragment
          }
        }
      `,
      {
        UserNameRenderer() {
          return {
            __typename: "MarkdownUserNameRenderer",
            __module_operation: require("./__generated__/RelayMockPayloadGeneratorTestMarkdownUserNameRenderer_name$normalization.graphql"),
          };
        },
      },
    );
  });

  xtest("should generate data for @match with MarkdownUserNameRenderer_name", () => {
    graphql`
      fragment RelayMockPayloadGeneratorTest31Fragment on User {
        id
        nameRenderer @match {
          ...RelayMockPayloadGeneratorTest1PlainUserNameRenderer_name
            @module(name: "PlainUserNameRenderer.react")
          ...RelayMockPayloadGeneratorTest1MarkdownUserNameRenderer_name
            @module(name: "MarkdownUserNameRenderer.react")
        }
      }
    `;
    graphql`
      fragment RelayMockPayloadGeneratorTest1PlainUserNameRenderer_name on PlainUserNameRenderer {
        plaintext
        data {
          text
        }
      }
    `;
    graphql`
      fragment RelayMockPayloadGeneratorTest1MarkdownUserNameRenderer_name on MarkdownUserNameRenderer {
        markdown
        data {
          markup
        }
      }
    `;
    testGeneratedData(
      graphql`
        query RelayMockPayloadGeneratorTest45Query @relay_test_operation {
          node(id: "my-id") {
            ...RelayMockPayloadGeneratorTest31Fragment
          }
        }
      `,
      {
        UserNameRenderer() {
          return {
            __typename: "MarkdownUserNameRenderer",
            __module_operation: require("./__generated__/RelayMockPayloadGeneratorTest1MarkdownUserNameRenderer_name$normalization.graphql"),
          };
        },
      },
    );
  });

  xtest("should generate data for @match with PlainUserNameRenderer_name", () => {
    graphql`
      fragment RelayMockPayloadGeneratorTest32Fragment on User {
        id
        nameRenderer @match {
          ...RelayMockPayloadGeneratorTest3PlainUserNameRenderer_name
            @module(name: "PlainUserNameRenderer.react")
          ...RelayMockPayloadGeneratorTest3MarkdownUserNameRenderer_name
            @module(name: "MarkdownUserNameRenderer.react")
        }
      }
    `;
    graphql`
      fragment RelayMockPayloadGeneratorTest3PlainUserNameRenderer_name on PlainUserNameRenderer {
        plaintext
        data {
          text
        }
      }
    `;
    graphql`
      fragment RelayMockPayloadGeneratorTest3MarkdownUserNameRenderer_name on MarkdownUserNameRenderer {
        markdown
        data {
          markup
        }
      }
    `;
    testGeneratedData(
      graphql`
        query RelayMockPayloadGeneratorTest46Query @relay_test_operation {
          node(id: "my-id") {
            ...RelayMockPayloadGeneratorTest32Fragment
          }
        }
      `,
      {
        UserNameRenderer() {
          return {
            __typename: "PlainUserNameRenderer",
            __module_operation: require("./__generated__/RelayMockPayloadGeneratorTest3PlainUserNameRenderer_name$normalization.graphql"),
          };
        },
      },
    );
  });

  xtest("should throw if invalid default value provide for __module_operation.", () => {
    graphql`
      fragment RelayMockPayloadGeneratorTest33Fragment on User {
        id
        nameRenderer {
          ...RelayMockPayloadGeneratorTest4MarkdownUserNameRenderer_name
            @module(name: "MarkdownUserNameRenderer.react")
        }
      }
    `;
    graphql`
      fragment RelayMockPayloadGeneratorTest4MarkdownUserNameRenderer_name on MarkdownUserNameRenderer {
        markdown
        data {
          markup
        }
      }
    `;
    expect(() => {
      testGeneratedData(
        graphql`
          query RelayMockPayloadGeneratorTest47Query @relay_test_operation {
            node(id: "my-id") {
              ...RelayMockPayloadGeneratorTest33Fragment
            }
          }
        `,
        {
          UserNameRenderer() {
            return {
              __typename: "MarkdownUserNameRenderer",
              __module_operation: {
                kind: "InvalidObject",
              },
            };
          },
        },
      );
    }).toThrowErrorMatchingSnapshot();
  });

  xtest("should generate data for @module with `null` in mock resolvers", () => {
    graphql`
      fragment RelayMockPayloadGeneratorTest34Fragment on User {
        id
        nameRenderer {
          ...RelayMockPayloadGeneratorTest5MarkdownUserNameRenderer_name
            @module(name: "MarkdownUserNameRenderer.react")
        }
      }
    `;
    graphql`
      fragment RelayMockPayloadGeneratorTest5MarkdownUserNameRenderer_name on MarkdownUserNameRenderer {
        markdown
        data {
          markup
        }
      }
    `;
    testGeneratedData(
      graphql`
        query RelayMockPayloadGeneratorTest48Query @relay_test_operation {
          node(id: "my-id") {
            ...RelayMockPayloadGeneratorTest34Fragment
          }
        }
      `,
      {
        UserNameRenderer() {
          return null;
        },
      },
    );
  });
});

test("generate mock for enum", () => {
  const fragment = graphql`
    fragment RelayMockPayloadGeneratorTestFragment on User {
      id
      name
      profile_picture {
        uri
        width
        height
        test_enums
      }
    }
  `;
  testGeneratedData(graphql`
    query RelayMockPayloadGeneratorTest1Query {
      node(id: "my-id") {
        __typename
        ...RelayMockPayloadGeneratorTestFragment
        id
      }
    }
    ${fragment}
  `);
});

test("deeply merges fragment data", () => {
  const RelayMockPayloadGeneratorTestDeepMergeFragment1 = graphql`
    fragment RelayMockPayloadGeneratorTestDeepMergeFragment1 on Page {
      author {
        environment
        address {
          city
        }
        ...RelayMockPayloadGeneratorTestDeepMergeFragment2
      }
    }
  `;
  const RelayMockPayloadGeneratorTestDeepMergeFragment2 = graphql`
    fragment RelayMockPayloadGeneratorTestDeepMergeFragment2 on User {
      environment
      address {
        city
        country
      }
    }
  `;
  testGeneratedData(
    graphql`
      query RelayMockPayloadGeneratorTestDeepMergeQuery {
        node(id: "my-id") {
          ...RelayMockPayloadGeneratorTestDeepMergeFragment1
          ...RelayMockPayloadGeneratorTestDeepMergeFragment2
        }
      }
      ${RelayMockPayloadGeneratorTestDeepMergeFragment1}
      ${RelayMockPayloadGeneratorTestDeepMergeFragment2}
    `,
  );
});
