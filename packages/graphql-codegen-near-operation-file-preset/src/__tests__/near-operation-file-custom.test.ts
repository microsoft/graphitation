import { buildASTSchema, parse } from "graphql";
import { preset } from "../index";

describe("near-operation-file preset", () => {
  describe("Issues", () => {
    it("#5002 - error when inline fragment does not specify the name of the type", async () => {
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
              ... @include(if: true) {
                id
                messages {
                  ...ChatMessageFragment
                }
              }
            }

            fragment ChatMessageFragment on ChatMessageConnection {
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

      expect(async () => {
        await preset.buildGeneratesSection({
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
                      query: ["myChats"],
                    },
                  },
                ],
              },
            },
            usedResolversMetadataFilePath: "./",
          },
          schema: testSchema,
          schemaAst: buildASTSchema(testSchema),
          documents: operations,
          plugins: [],
          pluginMap: {},
        });
      }).not.toThrow();
    });
  });
});
