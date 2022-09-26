import { useMutation } from "@apollo/client";
import React from "react";

import { TodoFragment } from "./graphql/TodoListQuery.graphql.interface";
import {
  TodoUpdateStatusMutation,
  TodoUpdateStatusMutationDocument,
  TodoUpdateStatusMutationVariables,
} from "./graphql/TodoUpdateStatusMutation.graphql.interface";

const Todo = ({ todo }: { todo: TodoFragment }) => {
  const [updateStatus] = useMutation<
    TodoUpdateStatusMutation,
    TodoUpdateStatusMutationVariables
  >(TodoUpdateStatusMutationDocument);
  return (
    <>
      <span>{todo.text}</span>
      <input
        type="checkbox"
        checked={todo.isCompleted}
        onChange={() => {
          updateStatus({
            variables: {
              input: {
                id: todo.id,
                isCompleted: !todo.isCompleted,
              },
            },
          });
        }}
      />
    </>
  );
};

export default Todo;
