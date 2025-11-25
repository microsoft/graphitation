import * as React from "react";
import { useQuery, useMutation, gql } from "@apollo/client";
import { Input, Button } from "@fluentui/react-components";

const MESSAGE = gql`
  query message($id: ID) {
    message(id: $id) {
      id
      text
    }
  }
`;

const UPDATE_MESSAGE = gql`
  mutation updateMessage($id: ID!, $text: String!) {
    updateMessage(id: $id, text: $text) {
      id
      text
    }
  }
`;

interface MessageProps {
  id: string;
}

export default ({ id }: MessageProps) => {
  const { data } = useQuery(MESSAGE, { variables: { id } });
  const [updateMessage] = useMutation(UPDATE_MESSAGE);
  const [isEditing, setIsEditing] = React.useState(false);
  const [editValue, setEditValue] = React.useState("");

  const messageText = data?.message?.text || "";

  React.useEffect(() => {
    setEditValue(messageText);
  }, [messageText]);

  const handleEdit = () => {
    setIsEditing(true);
  };

  const handleSave = () => {
    updateMessage({ variables: { id, text: editValue } });
    setIsEditing(false);
  };

  if (isEditing) {
    return (
      <div
        style={{
          display: "flex",
          gap: "8px",
          alignItems: "center",
          width: "100%",
        }}
      >
        <Input
          value={editValue}
          onChange={(e, data) => setEditValue(data.value)}
          autoFocus
          style={{ flex: 1 }}
          placeholder="Enter message..."
        />
        <Button
          appearance="primary"
          size="small"
          style={{ marginInlineEnd: "24px" }}
          onClick={handleSave}
        >
          Save
        </Button>
      </div>
    );
  }

  return (
    <div
      onClick={handleEdit}
      style={{ cursor: "pointer", minHeight: "20px", padding: "4px" }}
      title="Click to edit"
    >
      {messageText}
    </div>
  );
};
