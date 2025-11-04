import { IGraphQLContext } from "data/graphql-context";
import { sleep } from "../utils/sleep";

export const chatResolver = (
  _: object,
  parameters: any,
  context: IGraphQLContext,
) => {
  return context.chat();
};

export const addMessageResolver = async (
  _: object,
  { text }: any,
  context: IGraphQLContext,
) => {
  // Simulate network delay to make optimistic updates visible
  await sleep(1500);
  return context.addMessage(text + "Resolver");
};

export const messageResolver = (
  _: object,
  { id }: any,
  context: IGraphQLContext,
) => {
  return context.message(id);
};

export const updateMessageResolver = async (
  _: object,
  { id, text }: any,
  context: IGraphQLContext,
) => {
  // Simulate network delay to make optimistic updates visible
  await sleep(2500);
  return context.updateMessage(id, text + "Resolver");
};

export const removeMessageResolver = async (
  _: object,
  { id }: any,
  context: IGraphQLContext,
) => {
  // Simulate network delay to make optimistic updates visible
  await sleep(1500);
  return context.removeMessage(id);
};

export const shuffleMessagesResolver = (
  _: object,
  parameters: any,
  context: IGraphQLContext,
) => {
  return context.shuffleMessages();
};

export const userPreferenceResolver = async (
  _: object,
  parameters: any,
  context: IGraphQLContext,
) => {
  return await context.userPreference();
};
