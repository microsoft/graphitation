import React from "react";
import {
  useFragment,
  shallowCompareFragmentReferences,
} from "@graphitation/apollo-react-relay-duct-tape";
import { graphql } from "@graphitation/graphql-js-tag";

import { TodoListFooter_todosFragment$key } from "./__generated__/TodoListFooter_todosFragment.graphql";

const TodoListFooter: React.FC<{
  todos: TodoListFooter_todosFragment$key;
}> = ({ todos: todosRef }) => {
  const todos = useFragment(
    graphql`
      fragment TodoListFooter_todosFragment on TodosConnection {
        uncompletedCount
      }
    `,
    todosRef,
  );
  console.log("TodoListFooter watch data:", todos);

  return (
    <footer className="footer">
      <span className="todo-count">
        <strong>{todos.uncompletedCount}</strong> item
        {todos.uncompletedCount === 1 ? "" : "s"} left
      </span>
      {todos.uncompletedCount === 0 && (
        <button className="clear-completed">Clear completed</button>
      )}
    </footer>
  );
};

const MemoizedTodoListFooter = React.memo(
  TodoListFooter,
  shallowCompareFragmentReferences("todos"),
);
export { MemoizedTodoListFooter as TodoListFooter };
