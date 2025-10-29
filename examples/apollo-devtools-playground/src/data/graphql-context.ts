import { v4 as uid } from "uuid";

type Message = {
  id: string;
  text: string;
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
  shuffleMessages: () => boolean;
}

const createGraphQLContext: () => IGraphQLContext = () => {
  return new GraphQLContext();
};

export default createGraphQLContext;

class GraphQLContext implements IGraphQLContext {
  private static messages: Message[] = [
    { id: uid(), text: "Hello! This is your first message." },
  ];
  addMessage = (text: string) => {
    const id = uid();
    GraphQLContext.messages.push({ id, text });
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
  updateMessage = (id: string, text: string) => {
    const messageIndex = GraphQLContext.messages.findIndex(
      (value) => value.id === id,
    );
    if (messageIndex !== -1) {
      GraphQLContext.messages[messageIndex].text = text;
      return GraphQLContext.messages[messageIndex];
    }
    throw new Error(`Message with id ${id} not found`);
  };
  removeMessage = (id: string) => {
    const messages = GraphQLContext.messages.filter((value) => id !== value.id);
    GraphQLContext.messages = messages;

    return true;
  };
  shuffleMessages = () => {
    const messages = GraphQLContext.messages;
    for (let i = messages.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [messages[i], messages[j]] = [messages[j], messages[i]];
    }
    GraphQLContext.messages = messages;
    return true;
  };
}
