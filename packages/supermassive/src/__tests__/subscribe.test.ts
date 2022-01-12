import { parse, subscribe as graphQLSubscribe, isInputType } from "graphql";
import { subscribeWithoutSchema, subscribeWithSchema } from "..";
import schema, { typeDefs } from "../benchmarks/swapi-schema";
import models from "../benchmarks/swapi-schema/models";
import resolvers from "../benchmarks/swapi-schema/resolvers";
import { addTypesToRequestDocument } from "../ast/addTypesToRequestDocument";
import { extractImplicitTypes } from "../extractImplicitTypesRuntime";
import { Resolvers } from "../types";
import { specifiedScalars } from "../values";

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
  testCases.forEach(({ name, document, variables }: TestCase) => {
    it(name, async () => {
      await compareResultsForSubscribeWithSchema(document, variables);
    });
  });
  errorTestCases.forEach(({ name, document, variables }: TestCase) => {
    it(name, async () => {
      await compareErrorsForSubscribeWithSchema(document, variables);
    });
  });
});

describe("subscribeWithoutSchema", () => {
  testCases.forEach(({ name, document, variables }: TestCase) => {
    it(name, async () => {
      await compareResultsForSubscribeWithoutSchema(document, variables);
    });
  });
  errorTestCases.forEach(({ name, document, variables }: TestCase) => {
    it(name, async () => {
      await compareErrorsForSubscribeWithoutSchema(document, variables);
    });
  });
});

async function compareResultsForSubscribeWithSchema(
  query: string,
  variables?: Record<string, unknown>
) {
  expect.assertions(1);
  const document = parse(query);
  const results = [];

  const subscribeWithSchemaIterator = (await subscribeWithSchema({
    typeDefs,
    resolvers: (resolvers as unknown) as Resolvers<any, any>,
    document,
    contextValue: {
      models,
    },
    variableValues: variables,
  })) as any;
  let subscribeWithSchemaIteratorError;
  try {
    for await (const result of subscribeWithSchemaIterator) {
      results.push(result);
    }
  } catch (err: any) {
    subscribeWithSchemaIteratorError = err.message;
  }

  const graphQLSubscribeResults = [];
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
    for await (const result of graphQLSubscribeIterator) {
      graphQLSubscribeResults.push(result);
    }
  } catch (err: any) {
    graphqlSubscribeError = err.message;
  }

  if (graphqlSubscribeError || subscribeWithSchemaIteratorError) {
    expect(graphqlSubscribeError).toEqual(subscribeWithSchemaIteratorError);
    return;
  }

  expect(results).toEqual(graphQLSubscribeResults);
}

async function compareErrorsForSubscribeWithSchema(
  query: string,
  variables?: Record<string, unknown>
) {
  expect.assertions(1);
  const document = parse(query);
  const subscribeWithSchemaIterator = (await subscribeWithSchema({
    typeDefs,
    resolvers: (resolvers as unknown) as Resolvers<any, any>,
    document,
    contextValue: {
      models,
    },
    variableValues: variables,
  })) as any;
  let subscribeWithSchemaIteratorError;
  try {
    for await (const result of subscribeWithSchemaIterator) {
    }
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
    for await (const result of graphQLSubscribeIterator) {
    }
  } catch (err: any) {
    graphqlSubscribeError = err.message;
  }

  expect(graphqlSubscribeError).toEqual(subscribeWithSchemaIteratorError);
}

async function compareResultsForSubscribeWithoutSchema(
  query: string,
  variables: Record<string, unknown> = {}
) {
  expect.assertions(1);
  let fullResolvers: Resolvers<any, any> = {};
  const getTypeByName = (name: string) => {
    const type = specifiedScalars[name] || extractedResolvers[name];
    if (isInputType(type)) {
      return type;
    } else {
      throw new Error("Invalid type");
    }
  };
  const extractedResolvers: Resolvers<any, any> = extractImplicitTypes(
    typeDefs,
    getTypeByName
  );
  fullResolvers = {
    ...extractedResolvers,
    ...((resolvers as unknown) as Resolvers<any, any>),
  };
  const document = parse(query);
  const subscribeWithoutSchemaResults = [];
  const subscribeWithoutSchemaIterator = (await subscribeWithoutSchema({
    document: addTypesToRequestDocument(schema, document),
    contextValue: {
      models,
    },
    resolvers: fullResolvers,
    variableValues: variables,
  })) as any;
  for await (const result of subscribeWithoutSchemaIterator) {
    subscribeWithoutSchemaResults.push(result);
  }

  let graphQLSubscribeResults = [];
  const graphQLSubscribeIterator = (await graphQLSubscribe({
    document,
    contextValue: {
      models,
    },
    schema,
    variableValues: variables,
  })) as any;
  for await (const result of graphQLSubscribeIterator) {
    graphQLSubscribeResults.push(result);
  }
  expect(subscribeWithoutSchemaResults).toEqual(graphQLSubscribeResults);
}

async function compareErrorsForSubscribeWithoutSchema(
  query: string,
  variables: Record<string, unknown> = {}
) {
  expect.assertions(1);
  let fullResolvers: Resolvers<any, any> = {};
  const getTypeByName = (name: string) => {
    const type = specifiedScalars[name] || extractedResolvers[name];
    if (isInputType(type)) {
      return type;
    } else {
      throw new Error("Invalid type");
    }
  };

  const extractedResolvers: Resolvers<any, any> = extractImplicitTypes(
    typeDefs,
    getTypeByName
  );
  fullResolvers = {
    ...extractedResolvers,
    ...((resolvers as unknown) as Resolvers<any, any>),
  };
  const document = parse(query);
  let subscribeWithoutSchemaError;
  try {
    const subscribeWithoutSchemaIterator = (await subscribeWithoutSchema({
      document: addTypesToRequestDocument(schema, document),
      contextValue: {
        models,
      },
      resolvers: fullResolvers,
      variableValues: variables,
    })) as any;
    for await (const result of subscribeWithoutSchemaIterator) {
    }
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
    for await (const result of graphQLSubscribeIterator) {
    }
  } catch (err: any) {
    graphqlSubscribeError = err.message;
  }
  expect(graphqlSubscribeError).toEqual(subscribeWithoutSchemaError);
}
