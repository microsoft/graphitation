import { useMutation } from "@graphitation/apollo-react-relay-duct-tape";
import { graphql } from "@graphitation/graphql-js-tag";
import { useCallback } from "react";
import {
  ChangeTodoStatusInput,
  useChangeTodoStatusMutation as useChangeTodoStatusMutationType,
} from "./__generated__/useChangeTodoStatusMutation.graphql";
import invariant from "invariant";

const mutation = graphql`
  mutation useChangeTodoStatusMutation($input: ChangeTodoStatusInput!) {
    changeTodoStatus(input: $input) {
      todo {
        id
        isCompleted
      }
      todos {
        id
        totalCount
        uncompletedCount
      }
    }
  }
`;

// interface MutationData {
//   complete: boolean;
//   todoId: string;
//   userId: string;
//   completedCount: number;
// }

// function getOptimisticResponse(
//   optimisticData: MutationData
// ): useChangeTodoStatusMutationResponse {
//   return {
//     changeTodoStatus: {
//       todo: {
//         complete: optimisticData.complete,
//         id: optimisticData.todoId,
//       },
//       user: {
//         id: optimisticData.userId,
//         completedCount: optimisticData.complete
//           ? optimisticData.completedCount + 1
//           : optimisticData.completedCount - 1,
//       },
//     },
//   };
// }

export default function useChangeTodoStatusMutation() {
  const [commit] = useMutation<useChangeTodoStatusMutationType>(mutation);
  return [
    useCallback(
      (input: ChangeTodoStatusInput) => {
        return commit({
          variables: { input },
          onCompleted: (response) => {
            invariant(response.changeTodoStatus, "Expected response.changeTodoStatus in onCompleted");
          },
          // optimisticResponse: getOptimisticResponse(mutationData),
        });
      },
      [commit]
    ),
  ];
}
