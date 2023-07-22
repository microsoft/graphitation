import { useCallback } from "react";
// import { useMutation } from "@graphitation/apollo-react-relay-duct-tape";
import { useMutation } from "@apollo/client";
import { graphql } from "@graphitation/graphql-js-tag";

import { useAddTodoMutationResponse } from "./__generated__/useAddTodoMutation.graphql";
import invariant from "invariant";

const mutation = graphql`
  mutation useAddTodoMutation($input: AddTodoInput!) {
    addTodo(input: $input) {
      todoEdge {
        __typename
        # cursor
        node {
          id
          isCompleted
          description
        }
      }
      todos {
        id
        totalCount
        uncompletedCount
      }
    }
  }
`;

// function sharedUpdater(
//   store: RecordSourceSelectorProxy,
//   userId: string,
//   newEdge: RecordProxy
// ) {
//   const userProxy = store.get(userId);
//   if (!userProxy) {
//     return;
//   }
//   const connection = ConnectionHandler.getConnection(
//     userProxy,
//     "TodoList_todos"
//   );
//   if (!connection) {
//     return;
//   }
//   ConnectionHandler.insertEdgeAfter(connection, newEdge);
// }
// let tempID = 0;

export function useAddTodoMutation() {
  const [commit] = useMutation<useAddTodoMutationResponse>(mutation, {
    update(cache, { data }) {
      invariant(data?.addTodo, "Expected success result");
      const connectionId = data.addTodo.todos.id;
      const newTodoEdge = data.addTodo.todoEdge;
      cache.modify({
        id: `TodosConnection:${connectionId}`,
        fields: {
          edges(current) {
            return [...current, newTodoEdge];
          },
        },
      });
    },
  });
  return useCallback(
    (description: string) => {
      return commit({
        variables: {
          input: {
            description,
          },
        },
        //   updater: (store: RecordSourceSelectorProxy) => {
        //     const payload = store.getRootField("addTodo");
        //     if (!payload) {
        //       return;
        //     }
        //     const newEdge = payload.getLinkedRecord("todoEdge");
        //     if (!newEdge) {
        //       return;
        //     }
        //     sharedUpdater(store, userId, newEdge);
        //   },
        //   optimisticUpdater: (store: RecordSourceSelectorProxy) => {
        //     const id = "client:newTodo:" + tempID++;
        //     const node = store.create(id, "Todo");
        //     node.setValue(text, "text");
        //     node.setValue(id, "id");

        //     const newEdge = store.create(
        //       "client:newEdge:" + tempID++,
        //       "TodoEdge"
        //     );
        //     newEdge.setLinkedRecord(node, "node");
        //     sharedUpdater(store, userId, newEdge);

        //     // Get the UserProxy, and update the totalCount
        //     const userProxy = store.get(userId);

        //     if (!userProxy) {
        //       throw new Error("Failed to retrieve userProxy from store");
        //     }

        //     const totalCount = userProxy.getValue("totalCount");

        //     if (typeof totalCount !== "number") {
        //       throw new Error(
        //         `Expected userProxy.totalCount to be number, but got: ${typeof totalCount}`
        //       );
        //     }

        //     userProxy.setValue(totalCount + 1, "totalCount");
        //   }
      });
    },
    [commit],
  );
}
