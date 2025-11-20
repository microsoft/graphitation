import * as React from "react";
import { useQuery, gql, useMutation } from "@apollo/client";
import {
  Button,
  Input,
  Title3,
  Card,
  Text,
  makeStyles,
  shorthands,
  tokens,
} from "@fluentui/react-components";
import { Send20Regular, Delete20Regular } from "@fluentui/react-icons";

const CHAT = gql`
  query OptimisticChat {
    chat {
      messages {
        text
        id
      }
    }
  }
`;

const ADD_MESSAGE = gql`
  mutation addMessageOptimistic($text: String!) {
    addMessage(text: $text) {
      id
      text
    }
  }
`;

const REMOVE_MESSAGE = gql`
  mutation removeMessageOptimistic($id: ID!) {
    removeMessage(id: $id)
  }
`;

const UPDATE_MESSAGE = gql`
  mutation updateMessageOptimistic($id: ID!, $text: String!) {
    updateMessage(id: $id, text: $text) {
      id
      text
    }
  }
`;

const useStyles = makeStyles({
  container: {
    display: "flex",
    flexDirection: "column",
    ...shorthands.gap(tokens.spacingVerticalL),
    ...shorthands.padding(tokens.spacingVerticalXL),
    maxWidth: "800px",
    marginLeft: "auto",
    marginRight: "auto",
  },
  header: {
    display: "flex",
    flexDirection: "column",
    ...shorthands.gap(tokens.spacingVerticalS),
  },
  description: {
    color: tokens.colorNeutralForeground3,
  },
  inputGroup: {
    display: "flex",
    ...shorthands.gap(tokens.spacingHorizontalM),
  },
  messagesList: {
    display: "flex",
    flexDirection: "column",
    ...shorthands.gap(tokens.spacingVerticalM),
  },
  messageCard: {
    ...shorthands.padding(tokens.spacingVerticalM, tokens.spacingHorizontalL),
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    ...shorthands.gap(tokens.spacingHorizontalM),
  },
  messageContent: {
    flexGrow: 1,
    display: "flex",
    flexDirection: "column",
    ...shorthands.gap(tokens.spacingVerticalXS),
  },
  messageId: {
    fontFamily: tokens.fontFamilyMonospace,
    fontSize: tokens.fontSizeBase200,
    color: tokens.colorNeutralForeground3,
  },
  actions: {
    display: "flex",
    ...shorthands.gap(tokens.spacingHorizontalS),
  },
  infoBox: {
    ...shorthands.padding(tokens.spacingVerticalM, tokens.spacingHorizontalL),
    backgroundColor: tokens.colorBrandBackground2,
    ...shorthands.borderRadius(tokens.borderRadiusMedium),
    ...shorthands.border(
      tokens.strokeWidthThin,
      "solid",
      tokens.colorBrandStroke1,
    ),
  },
});

export const OptimisticUpdateDemo = () => {
  const classes = useStyles();
  const [messageText, setMessageText] = React.useState("");
  const { data, refetch } = useQuery(CHAT, {
    fetchPolicy: "cache-and-network",
  });

  const [addMessage, { loading: addingMessage }] = useMutation(ADD_MESSAGE, {
    optimisticResponse: (vars) => ({
      addMessage: {
        __typename: "Message",
        id: `temp-${Date.now()}`, // Temporary ID
        text: vars.text,
      },
    }),
    update: (cache, { data }) => {
      if (data?.addMessage) {
        // Update the cache optimistically
        try {
          const existingData: any = cache.readQuery({ query: CHAT });
          if (existingData?.chat?.messages) {
            cache.writeQuery({
              query: CHAT,
              data: {
                chat: {
                  __typename: "Chat",
                  messages: [...existingData.chat.messages, data.addMessage],
                },
              },
            });
          }
        } catch (e) {
          // If query doesn't exist in cache yet, just refetch
          refetch();
        }
      }
    },
  });

  const [removeMessage] = useMutation(REMOVE_MESSAGE, {
    optimisticResponse: (vars) => ({
      removeMessage: true,
    }),
    update: (cache, { data }, { variables }) => {
      if (data?.removeMessage && variables?.id) {
        // Optimistically update the cache
        const existingData: any = cache.readQuery({ query: CHAT });
        if (existingData?.chat?.messages) {
          cache.writeQuery({
            query: CHAT,
            data: {
              chat: {
                ...existingData.chat,
                messages: existingData.chat.messages.filter(
                  (msg: any) => msg.id !== variables.id,
                ),
              },
            },
          });
        }
      }
      // Refetch after mutation completes
      setTimeout(() => refetch(), 100);
    },
  });

  const [updateMessage] = useMutation(UPDATE_MESSAGE, {
    optimisticResponse: (vars) => ({
      updateMessage: {
        __typename: "Message",
        id: vars.id,
        text: vars.text,
      },
    }),
  });

  const handleAddMessage = async () => {
    if (!messageText.trim()) return;

    try {
      await addMessage({
        variables: { text: messageText },
      });
      setMessageText("");
    } catch (error) {
      console.error("Error adding message:", error);
    }
  };

  const handleRemoveMessage = async (id: string) => {
    try {
      await removeMessage({
        variables: { id },
      });
    } catch (error) {
      console.error("Error removing message:", error);
    }
  };

  const handleUpdateMessage = async (id: string) => {
    const newText = prompt("Enter new text for this message:");
    if (!newText) return;

    try {
      await updateMessage({
        variables: { id, text: newText },
      });
    } catch (error) {
      console.error("Error updating message:", error);
    }
  };

  const messages = data?.chat?.messages || [];

  return (
    <div className={classes.container}>
      <div className={classes.header}>
        <Title3>Optimistic Updates Demo</Title3>
        <Text className={classes.description}>
          This demo shows optimistic updates in action. When you add, update, or
          delete a message, the UI updates immediately (optimistically) before
          the server responds. Check the Apollo DevTools to see optimistic
          updates marked in the operation history!
        </Text>
      </div>

      <Card className={classes.infoBox}>
        <Text>
          💡 <strong>Tip:</strong> Open Apollo DevTools and look at the
          operation history. Optimistic updates will be marked with a blue
          "Optimistic" badge and have a blue-tinted background in the timeline.
        </Text>
      </Card>

      <div className={classes.inputGroup}>
        <Input
          placeholder="Type your message here..."
          value={messageText}
          onChange={(_, data) => setMessageText(data.value)}
          onKeyPress={(e) => {
            if (e.key === "Enter") {
              handleAddMessage();
            }
          }}
          style={{ flex: 1 }}
        />
        <Button
          appearance="primary"
          icon={<Send20Regular />}
          onClick={handleAddMessage}
          disabled={!messageText.trim() || addingMessage}
        >
          {addingMessage ? "Sending..." : "Send"}
        </Button>
      </div>

      <div className={classes.messagesList}>
        {messages.map((message: any) => (
          <Card key={message.id} className={classes.messageCard}>
            <div className={classes.messageContent}>
              <Text weight="semibold">{message.text}</Text>
              <Text className={classes.messageId}>ID: {message.id}</Text>
            </div>
            <div className={classes.actions}>
              <Button
                size="small"
                appearance="secondary"
                onClick={() => handleUpdateMessage(message.id)}
              >
                Edit
              </Button>
              <Button
                size="small"
                appearance="secondary"
                icon={<Delete20Regular />}
                onClick={() => handleRemoveMessage(message.id)}
              >
                Delete
              </Button>
            </div>
          </Card>
        ))}
        {messages.length === 0 && (
          <Text className={classes.description}>
            No messages yet. Add your first message above!
          </Text>
        )}
      </div>
    </div>
  );
};
