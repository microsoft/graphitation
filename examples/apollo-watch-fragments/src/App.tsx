import React, { useCallback } from "react";
import { useLazyLoadQuery } from "@graphitation/apollo-react-relay-duct-tape";
import { graphql } from "@graphitation/graphql-js-tag";

import { TodoTextInput } from "./TodoTextInput";
import { TodoList, TodoList_todosFragment } from "./TodoList";
import { TodoListFooter, TodoListFooter_todosFragment } from "./TodoListFooter";
import { useAddTodoMutation } from "./useAddTodoMutation";

import { AppQuery as AppQueryType } from "./__generated__/AppQuery.graphql";

export const AppQuery = graphql`
  query AppQuery {
    todos {
      totalCount
      ...TodoList_todosFragment
      ...TodoListFooter_todosFragment
    }
  }
  ${TodoList_todosFragment}
  ${TodoListFooter_todosFragment}
`;

const App: React.FC = () => {
  const addTodo = useAddTodoMutation();

  const result = useLazyLoadQuery<AppQueryType>(AppQuery, { variables: {} });
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

export default App;
