import React from "react";
import { useMutation } from "@apollo/client";
import {
  CreateTodoMutation,
  CreateTodoMutationDocument,
} from "./graphql/CreateTodoMutation.graphql.interface";
import {
  TodoListQuery,
  TodoListQueryDocument,
} from "./graphql/TodoListQuery.graphql.interface";
import { CreateTodoSuccess } from "../__generated__/types";

const CreateTodo: React.FC = () => {
  const [createTodo] = useMutation<CreateTodoMutation>(
    CreateTodoMutationDocument,
    {
      update: (cache, { data }) => {
        const existingData = cache.readQuery<TodoListQuery>({
          query: TodoListQueryDocument,
        });
        cache.writeQuery({
          query: TodoListQueryDocument,
          data: {
            ...existingData,
            allTodos: [
              ...existingData!.allTodos,
              (data!.createTodo as CreateTodoSuccess).todo,
            ].sort((a, b) => {
              return a.text.localeCompare(b.text);
            }),
          },
        });
      },
    }
  );

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        createTodo({
          variables: {
            input: {
              text: (event.target as any).elements.text.value,
            },
          },
        });
      }}
    >
      <input type="text" name="text" />
      <button type="submit">Add Todo</button>
    </form>
  );
};

export default CreateTodo;
