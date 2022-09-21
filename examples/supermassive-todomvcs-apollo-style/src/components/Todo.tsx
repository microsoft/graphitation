import React from "react";

import { TodoFragmentFragment } from "./graphql/TodoListQuery.graphql.interface";

const Todo = ({ todo }: { todo: TodoFragmentFragment }) => {
  return (
    <>
      <span>{todo.text}</span>
      <input type="checkbox" checked={todo.isCompleted} />
    </>
  );
};

export default Todo;
