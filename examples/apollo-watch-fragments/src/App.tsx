import React from "react";
import { graphql } from "@graphitation/graphql-js-tag";
import { useLazyLoadQuery } from "@graphitation/apollo-react-relay-duct-tape";

import { TodoTextInput } from "./TodoTextInput";
import { TodoList } from "./TodoList";
import { TodoListFooter } from "./TodoListFooter";
import { useAddTodoMutation } from "./useAddTodoMutation";

import { AppQuery as AppQueryType } from "./__generated__/AppQuery.graphql";

const App: React.FC = () => {
  const addTodo = useAddTodoMutation();

  const result = useLazyLoadQuery<AppQueryType>(
    graphql`
      query AppQuery(
        $includeSomeOtherField: Boolean!
        $count: Int!
        $after: String!
      ) {
        todoStats: todos(first: 0) {
          id
          totalCount
          ...TodoListFooter_todosFragment
        }
        ...TodoList_queryFragment
      }
    `,
    {
      includeSomeOtherField: false,
      count: 5,
      after: "",
    }
  );
  if (result.error) {
    throw result.error;
  } else if (!result.data) {
    return null;
  }
  console.log("App watch data:", result.data);

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
        <TodoList query={result.data} />
      </section>
      {result.data.todoStats.totalCount > 0 && (
        <TodoListFooter todos={result.data.todoStats} />
      )}
    </section>
  );
};

(App as any).whyDidYouRender = true;

export default App;
