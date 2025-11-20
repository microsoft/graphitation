import * as React from "react";
import { useQuery, gql, useMutation, useApolloClient } from "@apollo/client";
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

const CHAT_MANUAL = gql`
  query ChatManul {
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
  const client = useApolloClient();
  const { data, refetch, ...rest } = useQuery(CHAT, {
    variables: { history: 15 },
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

  // Manual cache write that only writes id (missing `text` field).
  // This will cause reads of CHAT to report a missing `text` field for the newly written items.
  const addIdOnlyMessageFunction = React.useCallback(() => {
    const id = String(Date.now());
    const existing = data?.chat?.messages ?? [];
    const newMsg = {
      id,
      __typename: "Message",
      // intentionally omit `text` to demonstrate a missing field when reading
    } as any;

    client.writeQuery({
      query: CHAT_MANUAL,
      data: {
        chat: {
          __typename: "Chat",
          messages: [...existing, newMsg],
        },
      },
    });
  }, [client, data]);

  return (
    <div>
      <button onClick={addIdOnlyMessageFunction}>Add ID-Only Message</button>
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
