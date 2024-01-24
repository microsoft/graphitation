import React, { useCallback } from "react";
import {
  useFragment,
  shallowCompareFragmentReferences,
  usePaginationFragment,
} from "@graphitation/apollo-react-relay-duct-tape";
import { graphql } from "@graphitation/graphql-js-tag";

import { TodoList_nodeFragment$key } from "./__generated__/TodoList_nodeFragment.graphql";
import { Todo } from "./Todo";
import { LoadingSpinner } from "./LoadingSpinner";

const TodoList: React.FC<{ node: TodoList_nodeFragment$key, refetch: () => void }> = ({
  node: nodeRef,
  refetch
}) => {
  const node = useFragment(
    graphql`
      fragment TodoList_nodeFragment on NodeWithTodos {
        __typename
        id
        todos(first: 5, after: $after) {
          edges {
            node {
              id
              isCompleted
              ...Todo_todoFragment
            }
          }
        }
      }
    `,
    nodeRef,
  );
  console.log("TodoList watch data:", node);

  /* <!-- List items should get the class `editing` when editing and `completed` when marked as completed --> */
  return (
    <ul className="todo-list">
      {node?.todos.edges.map(({ node: todo }) => {
        return (
          <li key={todo.id} className={todo.isCompleted ? "completed" : ""}>
            <Todo todo={todo} refetch={refetch} />
          </li>
        );
      })}
      {/* {hasNext || isLoadingNext ? (
        <li className="load-more">
          {isLoadingNext ? (
            <LoadingSpinner />
          ) : (
            <input
              type="submit"
              value="Load more..."
              onClick={() => loadNext(5)}
            />
          )}
        </li>
      ) : null} */}
    </ul>
  );
};

(TodoList as any).whyDidYouRender = true;

const MemoizedTodoList = React.memo(
  TodoList,
  shallowCompareFragmentReferences("node"),
);
export { MemoizedTodoList as TodoList };
