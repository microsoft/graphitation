import React from "react";

import { useQuery } from "@apollo/client";
import Todo from "./Todo";
import TodoUpdates from "./TodoUpdates";
import {
  TodoListQuery,
  TodoListQueryDocument,
} from "./graphql/TodoListQuery.graphql.interface";
import CreateTodo from "./CreateTodo";
import {
  TodoCreatedSubscription,
  TodoCreatedSubscriptionDocument,
} from "./graphql/TodoCreatedSubscription.graphql.interface";

const TodoList = () => {
  const { data, subscribeToMore } = useQuery<TodoListQuery>(
    TodoListQueryDocument
  );
  subscribeToMore<TodoCreatedSubscription>({
    document: TodoCreatedSubscriptionDocument,
    updateQuery: (prev, { subscriptionData }) => {
      const { todoCreated } = subscriptionData.data;
      // Unsure why this event comes twice.
      if (prev.allTodos.find((todo) => todo.id === todoCreated!.id)) {
        return prev;
      }
      return {
        ...prev,
        allTodos: [...prev.allTodos, todoCreated!].sort((a, b) =>
          a.text.localeCompare(b.text)
        ),
      };
    },
  });
  return (
    <>
      <TodoUpdates onNext={console.log} onError={console.log}>
        <h1>Todo List</h1>
        <ul>
          {(data as any)?.allTodos?.map((todo: any) => (
            <li key={todo.id}>
              <Todo todo={todo} />
            </li>
          ))}
        </ul>
      </TodoUpdates>
      <CreateTodo />
    </>
  );
};

export default TodoList;
