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
  // In People App, because we weren't able to use refetchable / pagination hook, we kept our variables
  // in a state and passed to the query. In this example, we're trying to reproduce it, but using after
  // variable (just an example, we could use any other variable)
  const [variables, setVariables] = React.useState({ after: "" });

  // Simplified the query to have only after variable (ignored includeSomeOtherField to keep it simple)
  const result = useLazyLoadQuery<AppQueryType>(
    graphql`
      query AppQuery($after: String) {
        me {
          todoStats: todos(first: 0, after: $after) {
            id
            totalCount
            ...TodoListFooter_todosFragment
          }
          ...TodoList_nodeFragment
        }
      }
    `,
    variables,
  );

  // This is a simplified version of how we're refetching data now. In our code, we raise an event  
  // that is caught on the host app side and it changes the variables (in our case, sortBy or filterBy)
  const refetch = () => {
    setVariables((prev) => ({
      after: prev.after + "1",
    }));
  };

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
        <TodoList node={result.data.me} refetch={refetch} />
      </section>
      {result.data.me.todoStats.totalCount > 0 && (
        <TodoListFooter todos={result.data.me.todoStats} />
      )}
    </section>
  );
};

(App as any).whyDidYouRender = true;

export default App;
