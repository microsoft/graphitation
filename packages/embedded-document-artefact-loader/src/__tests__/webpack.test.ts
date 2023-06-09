import { RunLoaderResult, runLoaders } from "loader-runner";

function runLoader(source: string) {
  return new Promise<RunLoaderResult>((resolve, reject) => {
    runLoaders(
      {
        resource: "/path/to/your/resource.js",
        loaders: [
          {
            loader: require.resolve("../webpack.ts"),
            options: {},
          },
        ],
        context: {},
        readResource: (_path, callback) => {
          callback(null, Buffer.from(source));
        },
      },
      (err, result) => {
        if (err) {
          reject(err);
        } else {
          resolve(result);
        }
      },
    );
  });
}

describe("webpackLoader", () => {
  it.todo("works with watch query documents");
  it.todo("has a dependency on the artefact file");

  it.each([
    {
      name: "files that contain no embedded documents",
      source: `
        import { graphql } from "@nova/react";
        console.log()
      `,
    },
    {
      name: "documents with query operations",
      source: `
        import { graphql } from "@nova/react";
        const doc = graphql\`
          query SomeComponentQuery($id: ID!) {
            helloWorld
          }
        \`;
        console.log()
      `,
    },
    {
      name: "documents with mutation operations",
      source: `
        import { graphql } from "@nova/react";
        const doc = graphql\`
          mutation SomeComponentMutation($id: ID!) {
            helloWorld
          }
        \`;
        console.log()
      `,
    },
    {
      name: "documents with subscription operations",
      source: `
        import { graphql } from "@nova/react";
        const doc = graphql\`
          subscription SomeComponentSubscription($id: ID!) {
            helloWorld
          }
        \`;
        console.log()
      `,
    },
    {
      name: "documents captured as variable",
      source: `
        import { graphql } from "@nova/react";
        const doc = graphql\`
          fragment SomeComponentFragment on Query {
            helloWorld
          }
        \`
        const {data} = useFragment(doc, props);
      `,
    },
    {
      name: "inline documents",
      source: `
        import { graphql } from "@nova/react";
        const {data} = useFragment(graphql\`
          fragment SomeComponentFragment on Query {
            helloWorld
          }
        \`, props);
      `,
    },
    {
      name: "inline documents over multiple lines",
      source: `
        import { graphql } from "@nova/react";
        const {data} = useFragment(
          graphql\`
            fragment SomeComponentFragment on Query {
              helloWorld
            }
          \`,
          props
        );
      `,
    },
  ])("works with $name", async ({ source }) => {
    const result = await runLoader(source);
    expect(result.result).toMatchSnapshot();
  });
});
