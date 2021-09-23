import React from "react";
import { useFragment } from "@graphitation/apollo-react-relay-duct-tape";
import { graphql } from "@graphitation/graphql-js-tag";

import { TodoListFooter_todosFragment$key } from "./__generated__/TodoListFooter_todosFragment.graphql";

export const TodoListFooter_todosFragment = graphql`
  fragment TodoListFooter_todosFragment on TodosConnection {
    uncompletedCount
  }
`;

export const TodoListFooter: React.FC<{
  todos: TodoListFooter_todosFragment$key;
}> = ({ todos: todosRef }) => {
  const todos = useFragment(TodoListFooter_todosFragment, todosRef);
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
