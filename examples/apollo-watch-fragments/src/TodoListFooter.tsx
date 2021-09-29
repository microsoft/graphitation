import React from "react";
import { useFragment } from "@graphitation/apollo-react-relay-duct-tape";
import { graphql } from "@graphitation/graphql-js-tag";

import {
  TodoListFooter_todosFragment$key,
  TodoListFooter_todosFragment as TodoListFooter_todosFragmentType,
} from "./__generated__/TodoListFooter_todosFragment.graphql";

// TODO: This needs to be done by a webpack loader:
import { useQuery as useApolloQuery } from "@apollo/client";
import { watchQueryDocument } from "./__generated__/TodoListFooter_todosWatchNodeQuery.graphql";

export const TodoListFooter_todosFragment = graphql`
  fragment TodoListFooter_todosFragment on TodosConnection {
    uncompletedCount
  }
`;

export const TodoListFooter: React.FC<{
  todos: TodoListFooter_todosFragment$key;
}> = ({ todos: todosRef }) => {
  // TODO: This needs to be replaced by the webpack loader
  // const todos = useFragment(TodoListFooter_todosFragment, todosRef);
  const response = useApolloQuery(watchQueryDocument as any, {
    variables: { id: (todosRef as any).id },
    fetchPolicy: "cache-only",
  });
  const todos = (response.data!
    .node as any) as TodoListFooter_todosFragmentType;

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
