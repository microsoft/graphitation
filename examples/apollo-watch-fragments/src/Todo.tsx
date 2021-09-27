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
import { documentNode as watchNodeQuery } from "./__generated__/Todo_todoWatchNodeQuery.graphql";

export const Todo_todoFragment = graphql`
  fragment Todo_todoFragment on Todo @watchNode {
    id
    description
    isCompleted
  }
`;

export const Todo: React.FC<{ todo: Todo_todoFragment$key }> = ({
  todo: todoRef,
}) => {
  // TODO: This needs to be replaced by the webpack loader
  // const todo = useFragment(Todo_todoFragment, todoRef);
  const response = useApolloQuery(watchNodeQuery as any, {
    variables: { id: (todoRef as any).id },
    fetchPolicy: "cache-only",
  });
  const todo = (response.data!.node as any) as Todo_todoFragmentType;

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
