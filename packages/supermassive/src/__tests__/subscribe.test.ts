import { parse, subscribe as graphQLSubscribe, isInputType } from "graphql";
import { subscribeWithoutSchema, subscribeWithSchema } from "..";
import schema, { typeDefs } from "../benchmarks/swapi-schema";
import models from "../benchmarks/swapi-schema/models";
import resolvers from "../benchmarks/swapi-schema/resolvers";
import { addTypesToRequestDocument } from "../ast/addTypesToRequestDocument";
import { extractImplicitTypes } from "../extractImplicitTypesRuntime";
import { UserResolvers, Resolvers } from "../types";
import { specifiedScalars } from "../values";
import { forAwaitEach } from "iterall";
import { mergeResolvers } from "../utilities/mergeResolvers";
import { resolvers as extractedResolvers } from "../benchmarks/swapi-schema/__generated__/schema";

interface TestCase {
  name: string;
  document: string;
  variables?: Record<string, unknown>;
}

const testCases: Array<TestCase> = [
  {
    name: "basic subscription with variables",
    document: `
  subscription emitPersons($limit: Int!) {
    emitPersons(limit: $limit) {
      name
      gender
    }
  }
 `,
    variables: {
      limit: 5,
    },
  },
  {
    name: "basic subscription with unused non-required variable",
    document: `
  subscription emitPersons($limit: Int!, $throwError: Boolean) {
    emitPersons(limit: $limit, throwError: $throwError) {
      name
      gender
    }
  }
 `,
    variables: {
      limit: 5,
    },
  },
];

const errorTestCases: Array<TestCase> = [
  {
    name: "subscription throw an error",
    document: `
  subscription emitPersons($limit: Int!, $throwError: Boolean) {
    emitPersons(limit: $limit, throwError: $throwError) {
      name
      gender
    }
  }
 `,
    variables: {
      limit: 5,
      throwError: true,
    },
  },
];

describe("subscribeWithSchema", () => {
  test.each(testCases)(
    ".subscribeWithSchema %s",
    async ({ name, document, variables }: TestCase) => {
      await compareResultsForSubscribeWithSchema(document, variables);
    },
  );
  test.each(errorTestCases)(
    ".subscribeWithSchema %s",
    async ({ name, document, variables }: TestCase) => {
      await compareErrorsForSubscribeWithSchema(document, variables);
    },
  );
});

describe("subscribeWithoutSchema", () => {
  test.each(testCases)(
    ".subscribeWithoutSchema %s",
    async ({ name, document, variables }: TestCase) => {
      await compareResultsForSubscribeWithoutSchema(document, variables);
    },
  );
  test.each(errorTestCases)(
    ".subscribeWithoutSchema %s",
    async ({ name, document, variables }: TestCase) => {
      await compareErrorsForSubscribeWithoutSchema(document, variables);
    },
  );
});

async function compareResultsForSubscribeWithSchema(
  query: string,
  variables?: Record<string, unknown>,
) {
  expect.assertions(1);
  const document = parse(query);

  const subscribeWithSchemaIterator = (await subscribeWithSchema({
    typeDefs,
    resolvers: (resolvers as unknown) as UserResolvers<any, any>,
    document,
    contextValue: {
      models,
    },
    variableValues: variables,
  })) as any;
  const subscribeWithSchemaResults: any[] = [];
  await forAwaitEach(subscribeWithSchemaIterator, (result) => {
    subscribeWithSchemaResults.push(result);
  });

  const graphQLSubscribeResults: any[] = [];
  const graphQLSubscribeIterator = (await graphQLSubscribe({
    document,
    contextValue: {
      models,
    },
    schema,
    variableValues: variables,
  })) as any;

  await forAwaitEach(graphQLSubscribeIterator, (result) => {
    graphQLSubscribeResults.push(result);
  });

  expect(subscribeWithSchemaResults).toEqual(graphQLSubscribeResults);
}

async function compareErrorsForSubscribeWithSchema(
  query: string,
  variables?: Record<string, unknown>,
) {
  expect.assertions(1);
  const document = parse(query);
  const subscribeWithSchemaIterator = (await subscribeWithSchema({
    typeDefs,
    resolvers: resolvers as UserResolvers<any, any>,
    document,
    contextValue: {
      models,
    },
    variableValues: variables,
  })) as any;
  let subscribeWithSchemaIteratorError;
  try {
    await forAwaitEach(subscribeWithSchemaIterator, (result) => {});
  } catch (err: any) {
    subscribeWithSchemaIteratorError = err.message;
  }

  let graphqlSubscribeError;
  const graphQLSubscribeIterator = (await graphQLSubscribe({
    document,
    contextValue: {
      models,
    },
    schema,
    variableValues: variables,
  })) as any;

  try {
    await forAwaitEach(graphQLSubscribeIterator, (result) => {});
  } catch (err: any) {
    graphqlSubscribeError = err.message;
  }

  expect(graphqlSubscribeError).toEqual(subscribeWithSchemaIteratorError);
}

async function compareResultsForSubscribeWithoutSchema(
  query: string,
  variables: Record<string, unknown> = {},
) {
  expect.assertions(1);
  const document = parse(query);
  const subscribeWithoutSchemaResults: any[] = [];
  const subscribeWithoutSchemaIterator = (await subscribeWithoutSchema({
    document: addTypesToRequestDocument(schema, document),
    contextValue: {
      models,
    },
    resolvers: resolvers as UserResolvers,
    schemaResolvers: extractedResolvers,
    variableValues: variables,
  })) as any;
  await forAwaitEach(subscribeWithoutSchemaIterator, (result) => {
    subscribeWithoutSchemaResults.push(result);
  });

  const graphQLSubscribeResults: any[] = [];
  const graphQLSubscribeIterator = (await graphQLSubscribe({
    document,
    contextValue: {
      models,
    },
    schema,
    variableValues: variables,
  })) as any;
  await forAwaitEach(graphQLSubscribeIterator, (result) => {
    graphQLSubscribeResults.push(result);
  });
  expect(subscribeWithoutSchemaResults).toEqual(graphQLSubscribeResults);
}

async function compareErrorsForSubscribeWithoutSchema(
  query: string,
  variables: Record<string, unknown> = {},
) {
  expect.assertions(1);
  const document = parse(query);
  let subscribeWithoutSchemaError;
  try {
    const subscribeWithoutSchemaIterator = (await subscribeWithoutSchema({
      document: addTypesToRequestDocument(schema, document),
      contextValue: {
        models,
      },
      resolvers: resolvers as UserResolvers,
      schemaResolvers: extractedResolvers,
      variableValues: variables,
    })) as any;
    await forAwaitEach(subscribeWithoutSchemaIterator, (result) => {});
  } catch (err: any) {
    subscribeWithoutSchemaError = err.message;
  }

  let graphqlSubscribeError;
  try {
    const graphQLSubscribeIterator = (await graphQLSubscribe({
      document,
      contextValue: {
        models,
      },
      schema,
      variableValues: variables,
    })) as any;
    await forAwaitEach(graphQLSubscribeIterator, (result) => {});
  } catch (err: any) {
    graphqlSubscribeError = err.message;
  }
  expect(graphqlSubscribeError).toEqual(subscribeWithoutSchemaError);
}
