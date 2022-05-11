import React from "react";
import { graphql } from "@graphitation/graphql-js-tag";
import { useLazyLoadQuery } from "@graphitation/apollo-react-relay-duct-tape";

import { LoadingSpinner } from "./LoadingSpinner";
import { TodoTextInput } from "./TodoTextInput";
import { TodoList } from "./TodoList";
import { TodoListFooter } from "./TodoListFooter";
import { useAddTodoMutation } from "./useAddTodoMutation";

import { AppQuery as AppQueryType } from "./__generated__/AppQuery.graphql";
import { useRef } from "react";
import { useState } from "react";

let done = false;

function useSuspender() {
  console.log(done);
  if (done) {
    return;
  }
  console.log("Going to suspend!");
  const promise = new Promise<void>((resolve) =>
    setTimeout(() => {
      console.log("Done suspending");
      done = true;
      console.log(done);
      // setTimeout(() => {
      // console.log("Resolving");
      resolve();
      // }, 1000);
    }, 5000)
  );
  throw promise;
}

const AppInner: React.FC = () => {
  useSuspender();
  console.log("Going to query!");
  const addTodo = useAddTodoMutation();

  const result = useLazyLoadQuery<AppQueryType>(
    graphql`
      query AppQuery($includeSomeOtherField: Boolean!) {
        todoStats: todos(first: 0) {
          id
          totalCount
          ...TodoListFooter_todosFragment
        }
        ...TodoList_queryFragment
      }
    `,
    { includeSomeOtherField: false }
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

const App: React.FC = () => {
  return (
    <React.Suspense fallback={<LoadingSpinner />}>
      <AppInner />
    </React.Suspense>
  );
};

(App as any).whyDidYouRender = true;

export default App;
