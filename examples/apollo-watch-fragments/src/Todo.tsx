import React from "react";
import { useFragment } from "@graphitation/apollo-react-relay-duct-tape";
import { graphql } from "@graphitation/graphql-js-tag";

import { Todo_todoFragment$key } from "./__generated__/Todo_todoFragment.graphql";

export const Todo_todoFragment = graphql`
  fragment Todo_todoFragment on Todo {
    description
    isCompleted
  }
`;

export const Todo: React.FC<{ todo: Todo_todoFragment$key }> = ({
  todo: todoRef,
}) => {
  const todo = useFragment(Todo_todoFragment, todoRef);
  return (
    <>
      <div className="view">
        <input
          className="toggle"
          type="checkbox"
          checked={todo.isCompleted}
          onChange={() => console.log("CHANGE!")}
        />
        <label>{todo.description}</label>
        <button className="destroy"></button>
      </div>
      {/* <input className="edit" value="Create a TodoMVC template" /> */}
    </>
  );
};
