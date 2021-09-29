import React from "react";
import { useFragment } from "@graphitation/apollo-react-relay-duct-tape";
import { graphql } from "@graphitation/graphql-js-tag";

import {
  TodoList_todosFragment$key,
  TodoList_todosFragment as TodoList_todosFragmentType,
} from "./__generated__/TodoList_todosFragment.graphql";
import { Todo, Todo_todoFragment } from "./Todo";

// TODO: This needs to be done by a webpack loader:
import { useQuery as useApolloQuery } from "@apollo/client";
import { watchQueryDocument } from "./__generated__/TodoList_todosWatchNodeQuery.graphql";

export const TodoList_todosFragment = graphql`
  fragment TodoList_todosFragment on TodosConnection {
    edges {
      node {
        id
        isCompleted
        ...Todo_todoFragment
      }
    }
  }
  ${Todo_todoFragment}
`;

export const TodoList: React.FC<{ todos: TodoList_todosFragment$key }> = ({
  todos: todosRef,
}) => {
  // TODO: This needs to be replaced by the webpack loader
  // const todos = useFragment(TodoList_todosFragment, todosRef);
  const response = useApolloQuery(watchQueryDocument as any, {
    variables: { id: (todosRef as any).id },
    fetchPolicy: "cache-only",
  });
  const todos = (response.data!.node as any) as TodoList_todosFragmentType;

  console.log("TodoList watch data:", todos);

  /* <!-- List items should get the class `editing` when editing and `completed` when marked as completed --> */
  return (
    <ul className="todo-list">
      {todos.edges.map(({ node: todo }) => {
        return (
          <li key={todo.id} className={todo.isCompleted ? "completed" : ""}>
            <Todo todo={todo} />
          </li>
        );
      })}
    </ul>
  );
};

(TodoList as any).whyDidYouRender = true;
