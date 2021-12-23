import React from "react";

import { useFragment } from "@graphitation/apollo-react-relay-duct-tape";
import { graphql } from "@graphitation/graphql-js-tag";

export const TodoFragment = graphql`
  fragment TodoFragment on Todo {
    id
    text
    isCompleted
  }
`;

const Todo = ({ todo: todoRef }: { todo: any }) => {
  const todo = useFragment(TodoFragment, todoRef);
  return (
    <>
      <span>{todo.text}</span>
      <input type="checkbox" value={todo.isCompleted} />
    </>
  );
};

export default Todo;
