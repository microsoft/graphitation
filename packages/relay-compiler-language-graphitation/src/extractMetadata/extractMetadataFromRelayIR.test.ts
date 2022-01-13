// import { Root } from "relay-compiler";
// import { extractMetadataFromRelayIR } from "./extractMetadataFromRelayIR";

// const { TestSchema, parseGraphQLText } = require("relay-test-utils-internal");

// const root: Partial<Root> = {
//   argumentDefinitions: [
//     {
//       kind: "LocalArgumentDefinition",
//       name: "avatarSize",
//       type: "ScalarType",
//       defaultValue: 21,
//       metadata: undefined,
//       loc: { kind: "Unknown" },
//     },
//   ],
// };

// function parseDefinition(document: string) {
//   return parseGraphQLText(TestSchema, document).definitions[0];
// }

import { CompilerContext, Printer } from "relay-compiler";
import * as ConnectionTransform from "relay-compiler/lib/transforms/ConnectionTransform";
import * as RefetchableFragmentTransform from "relay-compiler/lib/transforms/RefetchableFragmentTransform";
import { extractMetadataFromRelayIR } from "./extractMetadataFromRelayIR";
import { ReaderFragment } from "relay-runtime/lib/util/ReaderNode";
import { ConnectionPaginationMetadata } from "../types";
import { TaggedTemplateExpression } from "typescript";
import invariant from "invariant";

const { TestSchema, parseGraphQLText } = require("relay-test-utils-internal");

const ExtendedSchema = TestSchema.extend([
  ConnectionTransform.SCHEMA_EXTENSION,
  RefetchableFragmentTransform.SCHEMA_EXTENSION,
]);

function transform(text: string) {
  const { definitions } = parseGraphQLText(ExtendedSchema, text);

  const ir = new CompilerContext(ExtendedSchema)
    .addAll(definitions)
    .applyTransforms([
      ConnectionTransform.transform,
      RefetchableFragmentTransform.transform,
    ])
    .documents();

  return ir;
}

function graphql(template: TemplateStringsArray) {
  const ir = transform(template.raw[0])[0];
  invariant(ir, "Expected IR to have been created");
  return ir as ReaderFragment;
}

describe(extractMetadataFromRelayIR, () => {
  it.todo("ignores a connection without refetch");

  it("works with forward paginating connection", () => {
    const text = `
      fragment SomeConnectionFragment on User
        @refetchable(queryName: "SomeUserCommentsPaginationQuery")
      {
        comments(first: $commentCount, after: $commentCursor)
          @connection(key: "SomeUser_comments", filters: ["foo"])
        {
          edges {
            node {
              canViewerComment
            }
          }
        }
      }
    `;
    const ir = transform(text);
    const fragment = ir[0] as ReaderFragment;

    const expected: ConnectionPaginationMetadata = {
      path: ["comments"],
      forward: {
        count: "commentCount",
        cursor: "commentCursor",
      },
      backward: null,
    };
    expect(extractMetadataFromRelayIR(fragment)).toMatchObject({
      connection: expected,
    });
  });

  it("works with backward paginating connection", () => {
    const text = `
      fragment SomeConnectionFragment on User
        @refetchable(queryName: "SomeUserCommentsPaginationQuery")
      {
        comments(last: $commentCount, before: $commentCursor)
          @connection(key: "SomeUser_comments", filters: ["foo"])
        {
          edges {
            node {
              canViewerComment
            }
          }
        }
      }
    `;
    const ir = transform(text);
    const fragment = ir[0] as ReaderFragment;

    const expected: ConnectionPaginationMetadata = {
      path: ["comments"],
      forward: null,
      backward: {
        count: "commentCount",
        cursor: "commentCursor",
      },
    };
    expect(extractMetadataFromRelayIR(fragment)).toMatchObject({
      connection: expected,
    });
  });

  it("works with bidirection paginating connection", () => {
    const result = extractMetadataFromRelayIR(graphql`
      fragment UserFriendsFragment on Query
      @refetchable(queryName: "UserFriendsPaginationQuery") {
        me {
          friends(
            first: $friendsForwardCount
            after: $friendsAfterCursor
            last: $friendsBackwardCount
            before: $friendsBeforeCursor
          ) @connection(key: "UserFriends_friends") {
            edges {
              node {
                id
              }
            }
            pageInfo {
              endCursor
            }
          }
        }
      }
    `);
    const expected: ConnectionPaginationMetadata = {
      path: ["me", "friends"],
      forward: {
        count: "friendsForwardCount",
        cursor: "friendsAfterCursor",
      },
      backward: {
        count: "friendsBackwardCount",
        cursor: "friendsBeforeCursor",
      },
    };
    expect(result).toMatchObject({
      connection: expected,
    });
  });
});
