import { buildSchema } from "graphql";
import { plugin } from "..";

const testSchema = buildSchema(/* GraphQL */ `
  schema {
    query: Query
  }

  type Query {
    role: [ProjectRoleDetail!]!
  }

  type ProjectRoleDetail {
    code: String!
    name: String!
    email: String!
  }
`);

describe("TypeScript Resolvers Plugin", () => {
  it("generates models with omitted fields", async () => {
    const config = {
      modelIntersectionSuffix: "Template",
      mappersConfig: {
        ProjectRoleDetail: {
          extend: true,
          exclude: ["name", "email"],
        },
      },
      mappers: {
        ProjectRoleDetail: "../entities#ProjectRole",
      },
    };
    const output = await plugin(testSchema, [], config, {
      outputFile: "graphql.ts",
    });

    expect(output.content).toMatchInlineSnapshot(`
      "type ProjectRoleDetailModelOmitFields = \"name\" | \"email\";
      export type ProjectRole = Omit<ProjectRoleDetail, ProjectRoleDetailModelOmitFields> & ProjectRoleTemplate;
      "
    `);
  });

  it("generates the models without omitted fields", async () => {
    const config = {
      modelIntersectionSuffix: "Template",
      mappersConfig: {
        ProjectRoleDetail: {
          extend: true,
        },
      },
      mappers: {
        ProjectRoleDetail: "../entities#ProjectRole",
      },
    };
    const output = await plugin(testSchema, [], config, {
      outputFile: "graphql.ts",
    });

    expect(output.content).toMatchInlineSnapshot(`
      "export type ProjectRole = ProjectRoleDetail & ProjectRoleTemplate;
      "
    `);
  });

  it("just assigns alias into the type, which is used in resolverTypes", async () => {
    const config = {
      modelIntersectionSuffix: "Template",
      mappers: {
        ProjectRoleDetail: "../entities#ProjectRole",
      },
    };
    const output = await plugin(testSchema, [], config, {
      outputFile: "graphql.ts",
    });

    expect(output.content).toMatchInlineSnapshot(`
      "export type ProjectRole = ProjectRoleTemplate;
      "
    `);
  });

  it("doesn't generate anything", async () => {
    const baseConfig = {
      mappersConfig: {
        ProjectRoleDetail: {
          extend: true,
        },
      },
    };
    expect(
      (
        (await plugin(
          testSchema,
          [],
          {
            ...baseConfig,
            mappers: {
              ProjectRoleDetail: "../entities#ProjectRole",
            },
          },
          {
            outputFile: "graphql.ts",
          },
        )) as any
      ).content,
    ).toEqual("");

    expect(
      (
        (await plugin(
          testSchema,
          [],
          {
            ...baseConfig,
            modelIntersectionSuffix: "Template",
          },
          {
            outputFile: "graphql.ts",
          },
        )) as any
      ).content,
    ).toEqual("");
  });
});
