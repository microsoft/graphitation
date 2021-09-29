import React, { useCallback } from "react";
import { useFragment } from "@graphitation/apollo-react-relay-duct-tape";
import { graphql } from "@graphitation/graphql-js-tag";

import useChangeTodoStatusMutation from "./useChangeTodoStatusMutation";

import {
  Todo_todoFragment$key,
  Todo_todoFragment as Todo_todoFragmentType,
} from "./__generated__/Todo_todoFragment.graphql";

// TODO: This needs to be done by a webpack loader:
import { useQuery as useApolloQuery } from "@apollo/client";
import { watchQueryDocument } from "./__generated__/Todo_todoWatchNodeQuery.graphql";

export const Todo_todoFragment = graphql`
  fragment Todo_todoFragment on Todo {
    id
    description
    isCompleted
  }
`;

const Todo: React.FC<{ todo: Todo_todoFragment$key }> = ({ todo: todoRef }) => {
  // TODO: This needs to be replaced by the webpack loader
  // const todo = useFragment(Todo_todoFragment, todoRef);
  const response = useApolloQuery(watchQueryDocument as any, {
    variables: { id: (todoRef as any).id },
    fetchPolicy: "cache-only",
  });
  const todo = (response.data!.node as any) as Todo_todoFragmentType;

  console.log("Todo watch data:", todo);

  const [changeTodoStatus] = useChangeTodoStatusMutation();
  const handleCompleteChange = useCallback(
    (e: React.SyntheticEvent<HTMLInputElement>) => {
      const isCompleted = e.currentTarget.checked;
      changeTodoStatus({ id: todo.id, isCompleted });
    },
    [changeTodoStatus]
  );

  return (
    <>
      <div className="view">
        <input
          className="toggle"
          type="checkbox"
          checked={todo.isCompleted}
          onChange={handleCompleteChange}
        />
        <label>{todo.description}</label>
        <button className="destroy"></button>
      </div>
      {/* <input className="edit" value="Create a TodoMVC template" /> */}
    </>
  );
};

(Todo as any).whyDidYouRender = true;

const MemoizedTodo = React.memo(Todo);
export { MemoizedTodo as Todo };
