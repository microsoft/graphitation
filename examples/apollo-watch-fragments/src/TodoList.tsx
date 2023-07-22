import React, { useCallback } from "react";
import {
  useFragment,
  shallowCompareFragmentReferences,
  usePaginationFragment,
} from "@graphitation/apollo-react-relay-duct-tape";
import { graphql } from "@graphitation/graphql-js-tag";

import { TodoList_queryFragment$key } from "./__generated__/TodoList_queryFragment.graphql";
import { Todo } from "./Todo";
import { LoadingSpinner } from "./LoadingSpinner";

const TodoList: React.FC<{ query: TodoList_queryFragment$key }> = ({
  query: queryRef,
}) => {
  const {
    data: query,
    hasNext,
    loadNext,
    isLoadingNext,
  } = usePaginationFragment(
    graphql`
      fragment TodoList_queryFragment on Query
      @refetchable(queryName: "TodoListPaginationQuery")
      @argumentDefinitions(
        count: { type: "Int!", defaultValue: 5 }
        after: { type: "String!", defaultValue: "" }
      ) {
        todos(first: $count, after: $after)
          @connection(key: "TodosList_todos") {
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
    queryRef,
  );
  console.log("TodoList watch data:", query);

  /* <!-- List items should get the class `editing` when editing and `completed` when marked as completed --> */
  return (
    <ul className="todo-list">
      {query.todos.edges.map(({ node: todo }) => {
        return (
          <li key={todo.id} className={todo.isCompleted ? "completed" : ""}>
            <Todo todo={todo} />
          </li>
        );
      })}
      {hasNext || isLoadingNext ? (
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
      ) : null}
    </ul>
  );
};

(TodoList as any).whyDidYouRender = true;

const MemoizedTodoList = React.memo(
  TodoList,
  shallowCompareFragmentReferences("query"),
);
export { MemoizedTodoList as TodoList };
