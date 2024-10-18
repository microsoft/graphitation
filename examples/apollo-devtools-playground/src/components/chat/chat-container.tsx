import * as React from "react";
import { useApolloClient } from "@apollo/client/react";
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
  const client = useApolloClient();
  const cache = client.cache as any;
  const { data } = useQuery(CHAT);
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

  const removeMessageFunction = React.useCallback((id) => {
    removeMessage({
      variables: { id },
      update(cache) {
        cache.modify({
          fields: {
            chat: (previous) => {
              return [
                previous.messages.filter(
                  ({ messageId }: { messageId: string[] }) => messageId !== id,
                ),
              ];
            },
          },
        });
        const normalizedId = cache.identify({ id, __typename: "Message" });
        cache.evict({ id: normalizedId });
        cache.gc();
      },
    });
  }, []);

  React.useEffect(() => {
    const defaultData = ["test2", "test", "test", "test", "test2"];
    for (const message of defaultData) {
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
    }
  }, []);

  if (!cache) {
    return null;
  }

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
