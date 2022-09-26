import React from "react";

import { TodoFragment } from "./graphql/TodoListQuery.graphql.interface";

const Todo = ({ todo }: { todo: TodoFragment }) => {
  return (
    <>
      <span>{todo.text}</span>
      <input type="checkbox" checked={todo.isCompleted} />
    </>
  );
};

export default Todo;
