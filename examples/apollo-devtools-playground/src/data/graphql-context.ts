import { v4 as uid } from "uuid";

type Message = {
  id: string;
  message: string;
};

export type Chat = {
  messages: Message[];
};

export interface IGraphQLContext {
  message: (id: string) => Message;
  addMessage: (message: string) => Message;
  updateMessage: (id: string, message: string) => Message;
  chat: () => Chat;
  removeMessage: (id: string) => boolean;
}

const createGraphQLContext: () => IGraphQLContext = () => {
  return new GraphQLContext();
};

export default createGraphQLContext;

class GraphQLContext implements IGraphQLContext {
  private static messages: Message[] = [
    { id: uid(), message: "Hello! This is your first message." },
  ];
  addMessage = (message: string) => {
    const id = uid();
    GraphQLContext.messages.push({ id, message });
    const newMessage = GraphQLContext.messages.find((value) => id === value.id);
    return newMessage as Message;
  };
  chat = () => {
    return {
      messages: GraphQLContext.messages,
    };
  };
  message = (id: string) => {
    const message = GraphQLContext.messages.find((value) => id === value.id);
    return message as Message;
  };
  updateMessage = (id: string, message: string) => {
    const messageIndex = GraphQLContext.messages.findIndex(
      (value) => value.id === id,
    );
    if (messageIndex !== -1) {
      GraphQLContext.messages[messageIndex].message = message;
      return GraphQLContext.messages[messageIndex];
    }
    throw new Error(`Message with id ${id} not found`);
  };
  removeMessage = (id: string) => {
    const messages = GraphQLContext.messages.filter((value) => id !== value.id);
    GraphQLContext.messages = messages;

    return true;
  };
}
