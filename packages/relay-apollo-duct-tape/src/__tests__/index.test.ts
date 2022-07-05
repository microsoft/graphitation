import { graphql } from "@graphitation/graphql-js-tag";
import { writeQuery } from "..";
import { InMemoryCache } from "@apollo/client";

const query = graphql`
  query RelayApolloDuctTapeQuery {
    conversation {
      id
      title
    }
  }
`;

describe("writeQuery", () => {
  it("works", () => {
    const cache = new InMemoryCache();
    cache.writeQuery({
      query,
      data: {
        conversation: {
          id: "1",
          title: "Hello World",
        },
      },
    });
    expect(cache.extract()).toMatchInlineSnapshot(`
      Object {
        "ROOT_QUERY": Object {
          "__typename": "Query",
          "conversation": Object {
            "id": "1",
            "title": "Hello World",
          },
        },
      }
    `);
  });
});
