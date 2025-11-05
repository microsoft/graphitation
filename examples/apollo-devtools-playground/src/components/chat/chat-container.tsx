import * as React from "react";
import { useQuery, gql, useMutation } from "@apollo/client";
import { ChatRenderer } from "./chat-renderer";

const CHAT = gql`
  query Chat($history: Int) @cache(history: $history) {
    chat {
      messages {
        text
        id
      }
    }
  }
`;

const ADD_MESSAGES = gql`
  mutation addMessage($text: String!) {
    addMessage(text: $text) {
      id
      text
    }
  }
`;

const REMOVE_MESSAGE = gql`
  mutation removeMessage($id: ID!) {
    removeMessage(id: $id)
  }
`;

const SHUFFLE_MESSAGES = gql`
  mutation shuffleMessages {
    shuffleMessages
  }
`;

const ChatContainer = () => {
  const { data, refetch, ...rest } = useQuery(CHAT, {
    variables: { history: 5 },
  });
  const [addMessage] = useMutation(ADD_MESSAGES);
  const [removeMessage] = useMutation(REMOVE_MESSAGE);
  const [shuffleMessages] = useMutation(SHUFFLE_MESSAGES);

  const addMessageFunction = React.useCallback(
    async (text: string) => {
      await addMessage({
        variables: { text },
      });
      refetch();
    },
    [addMessage, refetch],
  );

  const removeMessageFunction = React.useCallback(
    async (id: string) => {
      await removeMessage({
        variables: { id },
      });
      refetch();
    },
    [removeMessage, refetch],
  );

  const shuffleMessagesFunction = React.useCallback(async () => {
    await shuffleMessages();
    refetch();
  }, [shuffleMessages, refetch]);

  return (
    <div>
      <ChatRenderer
        ids={
          data?.chat?.messages?.map(
            (message: { id: string } | null) => message?.id,
          ) || []
        }
        removeMessage={removeMessageFunction}
        addMessage={addMessageFunction}
        shuffleMessages={shuffleMessagesFunction}
      />
    </div>
  );
};

export default ChatContainer;
