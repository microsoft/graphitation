import * as React from "react";
import { useQuery, gql, useMutation } from "@apollo/client";
import { ChatRenderer } from "./chat-renderer";

const CHAT = gql`
  query Chat {
    chat {
      messages {
        id
      }
    }
  }
`;

const ADD_MESSAGES = gql`
  mutation addMessage($message: String!) {
    addMessage(message: $message) {
      id
      message
    }
  }
`;

const REMOVE_MESSAGE = gql`
  mutation removeMessage($id: ID!) {
    removeMessage(id: $id)
  }
`;

const ChatContainer = () => {
  const { data, refetch } = useQuery(CHAT);
  const [addMessage] = useMutation(ADD_MESSAGES);
  const [removeMessage] = useMutation(REMOVE_MESSAGE);

  const addMessageFunction = React.useCallback((message: string) => {
    addMessage({
      variables: { message },
      update(cache, mutationResult) {
        cache.modify({
          fields: {
            chat: (previous, { toReference }) => {
              return [
                ...(previous?.messages || []),
                toReference(mutationResult.data.addMessage),
              ];
            },
          },
        });
      },
    });
  }, []);

  const removeMessageFunction = React.useCallback(
    async (id: string) => {
      await removeMessage({
        variables: { id },
      });
      refetch();
    },
    [removeMessage, refetch],
  );

  return (
    <div>
      <ChatRenderer
        ids={data?.chat?.messages?.map(({ id }: { id: string }) => id) || []}
        removeMessage={removeMessageFunction}
        addMessage={addMessageFunction}
      />
    </div>
  );
};

export default ChatContainer;
