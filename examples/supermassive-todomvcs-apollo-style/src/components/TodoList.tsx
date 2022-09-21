import React from "react";

import { useQuery } from "@apollo/client";
import Todo from "./Todo";
import TodoUpdates from "./TodoUpdates";
import {
  TodoListQueryQuery,
  TodoListQueryDocument,
} from "./graphql/TodoListQuery.graphql.interface";

const TodoList = () => {
  console.log(TodoListQueryDocument);
  const { data } = useQuery(TodoListQueryDocument);
  return (
    <>
      <TodoUpdates onNext={console.log} onError={console.log}>
        <h1>Todo List</h1>
        <ul>
          {(data as any)?.allTodos?.map((todo: any) => (
            <li key={todo.id}>
              <Todo todo={todo} />
            </li>
          ))}
        </ul>
      </TodoUpdates>
    </>
  );
};

export default TodoList;
