import { IGraphQLContext } from "data/graphql-context";

export const chatResolver = (
  _: object,
  parameters: any,
  context: IGraphQLContext,
) => {
  return context.chat();
};

export const addMessageResolver = (
  _: object,
  { text }: any,
  context: IGraphQLContext,
) => {
  return context.addMessage(text);
};

export const messageResolver = (
  _: object,
  { id }: any,
  context: IGraphQLContext,
) => {
  return context.message(id);
};

export const updateMessageResolver = (
  _: object,
  { id, text }: any,
  context: IGraphQLContext,
) => {
  return context.updateMessage(id, text);
};

export const removeMessageResolver = (
  _: object,
  { id }: any,
  context: IGraphQLContext,
) => {
  return context.removeMessage(id);
};

export const shuffleMessagesResolver = (
  _: object,
  parameters: any,
  context: IGraphQLContext,
) => {
  return context.shuffleMessages();
};
