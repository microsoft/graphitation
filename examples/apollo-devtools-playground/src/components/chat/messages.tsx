import { Button, Text } from "@fluentui/react-components";
import Message from "./message";
import { useMessagesStyles } from "./messages.styles";

interface IMessages {
  ids: string[];
  removeMessage: (id: string) => void;
}

export const Messages = ({ ids, removeMessage }: IMessages) => {
  const classes = useMessagesStyles();

  const buildMessages = () => (id: string) =>
    (
      <div className={classes.itemContainer} key={id}>
        <div className={classes.idColumn}>{id}</div>
        <Message id={id} />
        <div>
          <Button
            appearance="primary"
            className={classes.button}
            size="small"
            onClick={() => {
              removeMessage(id);
            }}
          >
            Remove message
          </Button>
        </div>
      </div>
    );

  return (
    <div>
      <div className={classes.itemContainer}>
        <Text size={200} weight="semibold">
          ID
        </Text>
        <Text size={200} weight="semibold">
          Value
        </Text>
      </div>
      {ids.map(buildMessages())}
    </div>
  );
};
