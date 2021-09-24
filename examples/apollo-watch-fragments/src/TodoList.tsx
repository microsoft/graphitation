import React from "react";
import { useFragment } from "@graphitation/apollo-react-relay-duct-tape";
import { graphql } from "@graphitation/graphql-js-tag";

import { TodoList_todosFragment$key } from "./__generated__/TodoList_todosFragment.graphql";
import { Todo, Todo_todoFragment } from "./Todo";

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
  const todos = useFragment(TodoList_todosFragment, todosRef);
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
