import React from "react";

import { useSubscription } from "@apollo/client";
import {
  TodoUpdatesSubscriptionSubscription,
  TodoUpdatesSubscriptionDocument,
} from "./graphql/TodoUpdatesSubscription.graphql.interface";

interface TodoSubscriptionProps {
  onNext?: (response: any) => void;
  onError?: () => void | null;
}

const TodoUpdates: React.FC<TodoSubscriptionProps> = ({ onNext, children }) => {
  useSubscription<TodoUpdatesSubscriptionSubscription>(
    TodoUpdatesSubscriptionDocument,
    {
      variables: { limit: 5 },
      onSubscriptionData: onNext,
      // onError: onError || undefined,
    }
  );

  return <>{children}</>;
};

export default TodoUpdates;
