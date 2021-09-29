import React, { useCallback, useEffect, useRef, useState } from "react";
import { useLazyLoadQuery } from "@graphitation/apollo-react-relay-duct-tape";
import { graphql } from "@graphitation/graphql-js-tag";

import { TodoTextInput } from "./TodoTextInput";
import { TodoList, TodoList_todosFragment } from "./TodoList";
import { TodoListFooter, TodoListFooter_todosFragment } from "./TodoListFooter";
import { useAddTodoMutation } from "./useAddTodoMutation";

import { AppQuery as AppQueryType } from "./__generated__/AppQuery.graphql";

// TODO: This needs to be done by a webpack loader:
import {
  ApolloQueryResult,
  DocumentNode,
  useApolloClient,
  useQuery as useApolloQuery,
} from "@apollo/client";
import {
  executionQueryDocument,
  watchQueryDocument,
} from "./__generated__/AppQuery.graphql";

export const AppQuery = graphql`
  query AppQuery {
    todos {
      id
      totalCount
      ...TodoList_todosFragment
      ...TodoListFooter_todosFragment
    }
  }
  ${TodoList_todosFragment}
  ${TodoListFooter_todosFragment}
`;

function useExecuteAndWatchQuery(
  executionQuery: DocumentNode,
  watchQuery: DocumentNode,
  variables: Record<string, any>
) {
  const client = useApolloClient();
  const inFlightQuery = useRef<Promise<ApolloQueryResult<unknown>>>();

  const [[completed, error], setCompletionStatus] = useState<
    [completed: boolean, error: Error | undefined]
  >([false, undefined]);

  if (error) {
    throw error;
  }

  useEffect(() => {
    if (!completed && inFlightQuery.current === undefined) {
      inFlightQuery.current = client.query({
        query: executionQuery,
        variables,
      });
      inFlightQuery.current
        .then((result) => setCompletionStatus([true, result.error]))
        .catch((error) => setCompletionStatus([true, error]))
        .then(() => {
          // No need to hang onto this any longer than necessary.
          // TODO: How does Apollo evict from the store?
          inFlightQuery.current = undefined;
        });
    }
    return () => {
      // TODO: How does Apollo evict from the store?
      inFlightQuery.current = undefined;
    };
  }, [completed, inFlightQuery.current]);

  return useApolloQuery(watchQuery, {
    fetchPolicy: "cache-only",
    skip: !completed,
  });
}

const App: React.FC = () => {
  const addTodo = useAddTodoMutation();

  // TODO: This needs to be done by a webpack loader:
  // * copy over the variables from the original query
  //
  // const result = useLazyLoadQuery<AppQueryType>(AppQuery, { variables: {} });
  const result = useExecuteAndWatchQuery(
    executionQueryDocument as any,
    watchQueryDocument as any,
    { variables: {} }
  );

  if (result.error) {
    throw result.error;
  } else if (!result.data) {
    return null;
  }

  return (
    <section className="todoapp">
      <header className="header">
        <h1>todos</h1>
        <TodoTextInput
          className="new-todo"
          placeholder="What needs to be done?"
          onSave={addTodo}
        />
      </header>
      <section className="main">
        <input id="toggle-all" className="toggle-all" type="checkbox" />
        <label htmlFor="toggle-all">Mark all as complete</label>
        <TodoList todos={result.data.todos} />
      </section>
      {result.data.todos.totalCount > 0 && (
        <TodoListFooter todos={result.data.todos} />
      )}
    </section>
  );
};

(App as any).whyDidYouRender = true;

export default App;
