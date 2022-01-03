import React from "react";

import { useFragment } from "@graphitation/apollo-react-relay-duct-tape";
import { graphql } from "@graphitation/graphql-js-tag";
import { TodoFragment$key as TodoFragmentType } from "./__generated__/TodoFragment.graphql";

export const TodoFragment = graphql`
  fragment TodoFragment on Todo {
    id
    text
    isCompleted
  }
`;

const Todo = ({ todo: todoRef }: { todo: TodoFragmentType }) => {
  const todo = useFragment(TodoFragment, todoRef);
  return (
    <>
      <span>{todo.text}</span>
      <input type="checkbox" checked={todo.isCompleted} />
    </>
  );
};

export default Todo;
