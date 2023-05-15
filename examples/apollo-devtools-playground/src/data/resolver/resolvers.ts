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
  { message }: any,
  context: IGraphQLContext,
) => {
  return context.addMessage(message);
};

export const messageResolver = (
  _: object,
  { id }: any,
  context: IGraphQLContext,
) => {
  return context.message(id);
};

export const removeMessageResolver = (
  _: object,
  { id }: any,
  context: IGraphQLContext,
) => {
  return context.removeMessage(id);
};
