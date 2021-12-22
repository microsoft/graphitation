import React, { useCallback } from "react";
import {
  useRefetchableFragment,
  shallowCompareFragmentReferences,
} from "@graphitation/apollo-react-relay-duct-tape";
import { graphql } from "@graphitation/graphql-js-tag";

import useChangeTodoStatusMutation from "./useChangeTodoStatusMutation";

import { Todo_todoFragment$key } from "./__generated__/Todo_todoFragment.graphql";

const Todo: React.FC<{ todo: Todo_todoFragment$key }> = ({ todo: todoRef }) => {
  const [todo, refetch] = useRefetchableFragment(
    graphql`
      fragment Todo_todoFragment on Todo
      @refetchable(queryName: "TodoRefetchQuery") {
        id
        description
        isCompleted
        someOtherField @include(if: $includeSomeOtherField)
      }
    `,
    todoRef
  );
  console.log("Todo watch data:", todo);

  const [changeTodoStatus] = useChangeTodoStatusMutation();
  const handleCompleteChange = useCallback(
    (e: React.SyntheticEvent<HTMLInputElement>) => {
      const isCompleted = e.currentTarget.checked;
      changeTodoStatus({ id: todo.id, isCompleted });
    },
    [changeTodoStatus]
  );

  const refresh = useCallback(() => {
    refetch({ includeSomeOtherField: !todo.someOtherField });
  }, [refetch]);

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
        <button
          className="refresh"
          onClick={refresh}
          title={`To test refetching, run the following in your\nDevTools console and then click the refresh button:\n\n$client.link.context.db.setTodoStatus(${todo.id.replace(
            "Todo:",
            ""
          )}, ${!todo.isCompleted})`}
        ></button>
        <button className="destroy"></button>
      </div>
      {/* <input className="edit" value="Create a TodoMVC template" /> */}
    </>
  );
};

(Todo as any).whyDidYouRender = true;

const MemoizedTodo = React.memo(Todo, shallowCompareFragmentReferences("todo"));
export { MemoizedTodo as Todo };
