import * as React from "react";
import { Messages } from "./messages";
import { Title2, Button } from "@fluentui/react-components";
import { useChatRendererStyles } from "./chat-renderer.styles";

interface IChatRenderer {
  ids: string[];
  removeMessage: (id: string) => void;
  addMessage: (message: string) => void;
  shuffleMessages: () => void;
}

export const ChatRenderer = ({
  ids,
  removeMessage,
  addMessage,
  shuffleMessages,
}: IChatRenderer) => {
  const [messageText, setMessageText] = React.useState("");
  const styles = useChatRendererStyles();

  return (
    <>
      <Title2 block className={styles.title}>
        Chat example
      </Title2>
      <div className={styles.inputContainer}>
        <input
          className={styles.input}
          placeholder="Message"
          onChange={(e: React.SyntheticEvent) => {
            const input = e.target as HTMLInputElement;
            setMessageText(input.value);
          }}
        />
        <Button onClick={() => addMessage(messageText)}>Add Message</Button>
        <Button onClick={() => shuffleMessages()}>Shuffle Messages</Button>
      </div>
      <Messages ids={ids} removeMessage={removeMessage} />
    </>
  );
};
