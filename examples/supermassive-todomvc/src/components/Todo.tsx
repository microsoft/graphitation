import * as React from "react";

import { useFragment } from "@graphitation/apollo-react-relay-duct-tape";
import { graphql } from "@graphitation/graphql-js-tag";
import { TodoFragment$key } from "./__generated__/TodoFragment.graphql";

export const TodoFragment = graphql`
  fragment TodoFragment on Todo {
    id
    text
    isCompleted
  }
`;

const Todo = ({ todo: todoRef }: { todo: TodoFragment$key }) => {
  const todo = useFragment(TodoFragment, todoRef);

  return (
    <>
      <span>{todo.text}</span>
      <input type="checkbox" checked={todo.isCompleted} />
    </>
  );
};

export default Todo;
