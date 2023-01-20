import { plugin } from "../plugin";
import { FragmentDefinitionNode } from "graphql";
import { loadDocuments, loadSchemaSync } from "@graphql-tools/load";
import { GraphQLFileLoader } from "@graphql-tools/graphql-file-loader";
import * as path from "path";
import { LoadedFragment } from "@graphql-codegen/visitor-plugin-common";

const schema = loadSchemaSync(
  path.join(__dirname, "__fixtures__", "schema.graphql"),
  {
    loaders: [new GraphQLFileLoader()],
  },
);

async function loadFixture(name: string) {
  return loadDocuments(path.join(__dirname, "__fixtures__", name), {
    loaders: [new GraphQLFileLoader()],
    skipGraphQLImport: true,
  });
}

describe(plugin, () => {
  it("generates a ConcreteRequest for an operation", async () => {
    const operation = await loadFixture("SomeQuery.graphql");
    const fragments = await loadFixture("*Fragment.graphql");

    const { content } = await plugin(schema, operation, {
      externalFragments: fragments.map(
        (fragment) =>
          ({
            name: (fragment.document?.definitions[0] as FragmentDefinitionNode)
              .name.value,
            node: fragment.document?.definitions[0],
          } as LoadedFragment),
      ),
    });

    expect(content).toMatchSnapshot();
  });

  it("generates a ReaderFragment for a fragment", async () => {
    const mainFragment = await loadFixture("ConversationFragment.graphql");
    const fragments = await loadFixture("MessageFragment.graphql");

    const { content } = await plugin(schema, mainFragment, {
      externalFragments: fragments.map(
        (fragment) =>
          ({
            name: (fragment.document?.definitions[0] as FragmentDefinitionNode)
              .name.value,
            node: fragment.document?.definitions[0],
          } as LoadedFragment),
      ),
    });

    expect(content).toMatchSnapshot();
  });
});
