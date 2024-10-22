import * as React from "react";

import { useSubscription } from "@graphitation/apollo-react-relay-duct-tape";
import { graphql } from "@graphitation/graphql-js-tag";

const subscription = graphql`
  subscription TodoUpdatesSubscription($limit: Int!) {
    emitTodos(limit: $limit) {
      id
      ...TodoFragment
    }
  }
`;

interface TodoSubscriptionProps {
  onNext?: (response: any) => void;
  onError?: () => void | null;
}

const TodoUpdates: React.FC<TodoSubscriptionProps> = ({
  onNext,
  onError,
  children,
}) => {
  useSubscription({
    subscription,
    variables: { limit: 5 },
    onNext,
    onError: onError || undefined,
  });

  return <>{children}</>;
};

export default TodoUpdates;
