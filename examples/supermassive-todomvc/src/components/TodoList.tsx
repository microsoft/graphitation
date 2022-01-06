import React from "react";

import { useLazyLoadQuery } from "@graphitation/apollo-react-relay-duct-tape";
import { graphql } from "@graphitation/graphql-js-tag";
import Todo, { TodoFragment } from "./Todo";
import { TodoListQuery } from "./__generated__/TodoListQuery.graphql";

const TodoList = () => {
  const { data } = useLazyLoadQuery<TodoListQuery>(
    graphql`
      query TodoListQuery {
        allTodos {
          id
          ...TodoFragment
        }
      }

      ${TodoFragment}
    `,
    {}
  );
  return (
    <>
      <h1>Todo List</h1>
      <ul>
        {(data as any)?.allTodos?.map((todo: any) => (
          <li key={todo.id}>
            <Todo todo={todo} />
          </li>
        ))}
      </ul>
    </>
  );
};

export default TodoList;
