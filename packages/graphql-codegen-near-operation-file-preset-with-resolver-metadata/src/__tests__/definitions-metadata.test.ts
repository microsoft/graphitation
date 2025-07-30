import { buildASTSchema, DocumentNode, parse } from "graphql";
import { Source } from "@graphql-tools/utils";
import { preset } from "../index";

var mockWriteFileSync: jest.Mock;

jest.mock("fs", () => {
  mockWriteFileSync = jest.fn();

  return {
    ...jest.requireActual("fs"),
    writeFileSync: mockWriteFileSync,
  };
});

function getConfig(
  schema: DocumentNode,
  operations: Source[],
  enabledQueries: string[],
) {
  return {
    baseOutputDir: "./src/",
    config: {},
    presetConfig: {
      folder: "__generated__",
      baseTypesPath: "types.ts",
      supportedResolvers: {
        supportedResolvers: {
          configs: [
            {
              value: {
                query: enabledQueries,
              },
            },
          ],
        },
      },
      usedResolversMetadataDirectoryPath: "./",
    },
    schema,
    schemaAst: buildASTSchema(schema),
    documents: operations,
    plugins: [],
    pluginMap: {},
  };
}

describe("resolve-document-imports", () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  it("Basic test", async () => {
    const testSchema = parse(/* GraphQL */ `
      scalar Date

      schema {
        query: Query
      }

      type Query {
        me: User!
        user(id: ID!): User
        terribleName(id: ID!): User
        allUsers: [User]
        search(term: String!): [SearchResult!]!
        myChats: [Chat!]!
      }

      enum Role {
        USER
        ADMIN
      }

      interface IConnection {
        pageInfo: PageInfo!
        edges: [IEdge!]!
      }

      type PageInfo {
        startCursor: String
        endCursor: String
        hasNextPage: Boolean!
        hasPreviousPage: Boolean
      }

      interface IEdge {
        cursor: String
        node: IEdgeNode!
      }

      interface IEdgeNode {
        id: ID!
      }

      type ChatMessageConnection implements IConnection {
        pageInfo: PageInfo!
        edges: [ChatMessageEdge!]!
      }

      type ChatMessageEdge implements IEdge {
        node: ChatMessage!
        cursor: String
      }

      type ChatMessage implements IEdgeNode {
        id: ID!
        content: String!
        time: Date!
        user: User!
      }

      interface Node {
        id: ID!
      }

      union SearchResult = User | Chat | ChatMessage

      type User implements Node {
        id: ID!
        username: String!
        email: String!
        role: Role!
      }

      type Chat implements Node {
        id: ID!
        test33: String!
        users: [User!]!
        messages: ChatMessageConnection!
      }
    `);

    const sharedFragmentsDirectoryName = "common-fragment-package";
    const operations = [
      {
        location: "test.graphql",
        document: parse(/* GraphQL */ `
          query chats {
            myChats {
              ...ChatFields
              ...ChatFragment
              messages {
                edges {
                  node {
                    id
                    content
                    time
                    user {
                      id
                      username
                    }
                  }
                }
              }
            }
            me {
              id
              username
            }
            terribleName {
              id
              username
            }
          }

          fragment terribleName on User {
            id
            email
          }

          fragment ChatFields on Chat {
            id
            ... @include(if: true) {
              id
              messages {
                edges {
                  node {
                    id
                    content
                    time
                    user {
                      id
                      username
                    }
                  }
                }
              }
            }
          }
        `),
      },
      {
        location: sharedFragmentsDirectoryName,
        document: parse(/* GraphQL */ `
          fragment ChatFragment on Chat {
            id
            test33
            ... @include(if: true) {
              id
              messages {
                ...ChatMessageFragment
              }
            }
          }

          fragment ChatMessageFragment on ChatMessageConnection {
            ... on IConnection {
              pageInfo {
                startCursor
              }
            }
            edges {
              node {
                id
                user {
                  id
                  username
                }
              }
            }
          }
        `),
      },
    ];

    await preset.buildGeneratesSection(
      getConfig(testSchema, operations, ["myChats"]),
    );

    expect(mockWriteFileSync).toHaveBeenCalled();
    const params = mockWriteFileSync.mock.calls[0][1];
    expect(params).toMatchInlineSnapshot(`
      "{
        "supportedOperations": {
          "query": [
            "chats"
          ]
        },
        "resolverMetadata": {
          "Query": [
            "myChats",
            "me",
            "terribleName"
          ],
          "Chat": [
            "messages",
            "id",
            "test33"
          ],
          "ChatMessageConnection": [
            "edges",
            "pageInfo"
          ],
          "ChatMessageEdge": [
            "node"
          ],
          "ChatMessage": [
            "id",
            "content",
            "time",
            "user"
          ],
          "User": [
            "id",
            "username"
          ],
          "IConnection": [
            "__resolveType"
          ],
          "PageInfo": [
            "startCursor"
          ]
        }
      }"
    `);
  });

  it("unions", async () => {
    const testSchema = parse(/* GraphQL */ `
      schema {
        query: Query
      }

      type Query {
        content: ContentUnion!
      }

      interface Node {
        id: ID!
      }

      union ContentUnion = Message | Article

      enum ContentType {
        TEXT
        HTML
      }

      type Message implements Node {
        id: ID!
        text: String!
        type: ContentType
      }

      type Article implements Node {
        id: ID!
        content: String!
        type: ContentType
        comment: CommentUnion!
      }

      union CommentUnion = TextComment | HTMLComment

      type TextComment {
        id: ID!
        text: String!
      }

      type HTMLComment {
        id: ID!
        html: String!
      }
    `);

    const operations = [
      {
        location: "test.graphql",
        document: parse(/* GraphQL */ `
          query ContentQuery1 {
            content {
              ... on Article {
                id
                content
                type
                comment {
                  ... on TextComment {
                    id
                    text
                  }
                }
              }
              ... on Message {
                id
                text
                type
              }
            }
          }
        `),
      },
    ];

    await preset.buildGeneratesSection(
      getConfig(testSchema, operations, ["content"]),
    );

    expect(mockWriteFileSync).toHaveBeenCalled();
    const params = mockWriteFileSync.mock.calls[0][1];
    expect(params).toMatchInlineSnapshot(`
      "{
        "supportedOperations": {
          "query": [
            "ContentQuery1"
          ]
        },
        "resolverMetadata": {
          "Query": [
            "content"
          ],
          "ContentUnion": [
            "__resolveType"
          ],
          "Article": [
            "id",
            "content",
            "type",
            "comment"
          ],
          "CommentUnion": [
            "__resolveType"
          ],
          "TextComment": [
            "id",
            "text"
          ],
          "Message": [
            "id",
            "text",
            "type"
          ]
        }
      }"
    `);
  });

  it("interfaces", async () => {
    const testSchema = parse(/* GraphQL */ `
      schema {
        query: Query
      }

      type Query {
        content: ContentUnion!
      }

      interface Node {
        id: ID!
      }

      union ContentUnion = Message | Article

      enum ContentType {
        TEXT
        HTML
      }

      type Message implements Node {
        id: ID!
        text: String!
        type: ContentType
      }

      type Article implements Node {
        id: ID!
        content: String!
        type: ContentType
        comment: CommentInterface!
      }

      interface CommentInterface {
        id: ID!
        text: String!
      }

      type TextComment implements CommentInterface {
        id: ID!
        text: String!
      }

      type HTMLComment implements CommentInterface {
        id: ID!
        text: String!
        html: String!
      }
    `);

    const operations = [
      {
        location: "test.graphql",
        document: parse(/* GraphQL */ `
          query ContentQuery1 {
            content {
              ... on Article {
                id
                content
                type
                comment {
                  id
                  text
                  ... on CommentInterface {
                    id
                    text
                  }
                  ... on HTMLComment {
                    html
                  }
                }
              }
              ... on Message {
                id
                text
                type
              }
            }
          }
        `),
      },
    ];

    await preset.buildGeneratesSection(
      getConfig(testSchema, operations, ["content"]),
    );

    expect(mockWriteFileSync).toHaveBeenCalled();
    const params = mockWriteFileSync.mock.calls[0][1];
    expect(params).toMatchInlineSnapshot(`
      "{
        "supportedOperations": {
          "query": [
            "ContentQuery1"
          ]
        },
        "resolverMetadata": {
          "Query": [
            "content"
          ],
          "ContentUnion": [
            "__resolveType"
          ],
          "Article": [
            "id",
            "content",
            "type",
            "comment"
          ],
          "CommentInterface": [
            "__resolveType"
          ],
          "HTMLComment": [
            "html",
            "id",
            "text"
          ],
          "Message": [
            "id",
            "text",
            "type"
          ]
        }
      }"
    `);
  });
});
