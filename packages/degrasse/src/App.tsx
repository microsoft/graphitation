import React from "react";
import * as GraphiQL from "graphiql";
import * as graphql from "graphql";

const InitialCode = `
  type Query {
    message: Message!
  }

  type Message {
    text: String!
  }
`;

const Output: React.FC<{ code: string }> = (props) => {
  let schema: graphql.GraphQLSchema | undefined;
  let error: graphql.GraphQLError | undefined;
  try {
    schema = graphql.buildSchema(props.code);
  } catch (e) {
    error = new graphql.GraphQLError((e as Error).message);
  }
  const fetcher: GraphiQL.Fetcher = (graphQLParams) => {
    if (!schema) {
      return Promise.resolve({ errors: [error!] });
    }
    return graphql.execute({
      schema,
      document: graphql.parse(graphQLParams.query),
      variableValues: graphQLParams.variables,
      operationName: graphQLParams.operationName,
    });
  };
  return <GraphiQL.GraphiQL fetcher={fetcher} />;
};

const App: React.FC = () => {
  const [code, setCode] = React.useState(InitialCode);
  const deferredCode = React.useDeferredValue(code);
  return (
    <>
      <textarea
        cols={80}
        rows={10}
        onChange={(event) => setCode(event.target.value)}
        defaultValue={deferredCode}
      ></textarea>
      <Output code={deferredCode} />
    </>
  );
};

export default App;
