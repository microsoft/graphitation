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
import { TodoListPaginationQuery } from "./__generated__/TodoListPaginationQuery.graphql";

const TodoList: React.FC<{ node: TodoList_nodeFragment$key }> = ({
  node: nodeRef,
}) => {
  const [order, setOrder] = React.useState<"ASC" | "DESC">("ASC");
  const {
    data: node,
    hasNext,
    loadNext,
    isLoadingNext,
    refetch,
  } = usePaginationFragment<TodoListPaginationQuery, TodoList_nodeFragment$key>(
    graphql`
      fragment TodoList_nodeFragment on NodeWithTodos
      @refetchable(queryName: "TodoListPaginationQuery")
      @argumentDefinitions(
        count: { type: "Int!", defaultValue: 5 }
        after: { type: "String!", defaultValue: "" }
        sortBy: {
          type: "SortByInput"
          defaultValue: { sortField: DESCRIPTION, sortDirection: ASC }
        } # TODO: adding default value for sortBy break the compiler, removing default value makes it work again
      ) {
        __typename
        todos(first: $count, after: $after, sortBy: $sortBy)
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
    nodeRef,
  );
  console.log("TodoList watch data:", node);

  const onChangeOrder = () => {
    const newOrder = order === "ASC" ? "DESC" : "ASC";
    setOrder(newOrder);
    refetch({ sortBy: { sortField: "DESCRIPTION", sortDirection: newOrder } });
  };

  /* <!-- List items should get the class `editing` when editing and `completed` when marked as completed --> */
  return (
    <>
      <ul className="todo-list">
        {node.todos.edges.map(({ node: todo }) => {
          return (
            <li key={todo.id} className={todo.isCompleted ? "completed" : ""}>
              <Todo todo={todo} />
            </li>
          );
        })}
        {hasNext || isLoadingNext ? (
          <li className="action">
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
        <li className="action">
          <input
            type="submit"
            className="sort-button"
            onClick={onChangeOrder}
            value={`Sort ${order === "ASC" ? "descending" : "ascending"}`}
          />
        </li>
      </ul>
    </>
  );
};

(TodoList as any).whyDidYouRender = true;

const MemoizedTodoList = React.memo(
  TodoList,
  shallowCompareFragmentReferences("node"),
);
export { MemoizedTodoList as TodoList };
