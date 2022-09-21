// THIS FILE IS GENERATED BY graphql-codegen. DO NOT MODIFY!
// RUN `yarn generate:interfaces` from the package root to update it
// See <PACKAGE_ROOT>/codegen.yml for details
/* eslint-disable */
// @ts-nocheck

export type Maybe<T> = T | null;
export type InputMaybe<T> = Maybe<T>;
export type Exact<T extends { [key: string]: unknown }> = { [K in keyof T]: T[K] };
export type MakeOptional<T, K extends keyof T> = Omit<T, K> & { [SubKey in K]?: Maybe<T[SubKey]> };
export type MakeMaybe<T, K extends keyof T> = Omit<T, K> & { [SubKey in K]: Maybe<T[SubKey]> };
/** All built-in and custom scalars, mapped to their actual values */
export type Scalars = {
  ID: string;
  String: string;
  Boolean: boolean;
  Int: number;
  Float: number;
};

export type CreateTodoFailure = Failure & {
  __typename?: 'CreateTodoFailure';
  reason: Scalars['String'];
};

export type CreateTodoInput = {
  text: Scalars['String'];
};

export type CreateTodoResult = CreateTodoSuccess | CreateTodoFailure;

export type CreateTodoSuccess = {
  __typename?: 'CreateTodoSuccess';
  todo: Todo;
};

export type Failure = {
  reason: Scalars['String'];
};

export type Mutation = {
  __typename?: 'Mutation';
  createTodo: CreateTodoResult;
  updateTodoText: UpdateTodoTextResult;
  setTodoCompleted: SetTodoCompletedResult;
};


export type MutationCreateTodoArgs = {
  input: CreateTodoInput;
};


export type MutationUpdateTodoTextArgs = {
  input: UpdateTodoTextInput;
};


export type MutationSetTodoCompletedArgs = {
  input: SetTodoCompletedInput;
};

export type Query = {
  __typename?: 'Query';
  allTodos: Array<Todo>;
};

export type SetTodoCompletedFailure = Failure & {
  __typename?: 'SetTodoCompletedFailure';
  reason: Scalars['String'];
};

export type SetTodoCompletedInput = {
  id: Scalars['ID'];
  isCompleted: Scalars['Boolean'];
};

export type SetTodoCompletedResult = SetTodoCompletedSuccess | SetTodoCompletedFailure;

export type SetTodoCompletedSuccess = {
  __typename?: 'SetTodoCompletedSuccess';
  todo: Todo;
};

export type Subscription = {
  __typename?: 'Subscription';
  emitTodos?: Maybe<Todo>;
};


export type SubscriptionEmitTodosArgs = {
  limit: Scalars['Int'];
};

export type Todo = {
  __typename?: 'Todo';
  id: Scalars['ID'];
  text: Scalars['String'];
  isCompleted: Scalars['Boolean'];
};

export type UpdateTodoTextFailure = Failure & {
  __typename?: 'UpdateTodoTextFailure';
  reason: Scalars['String'];
};

export type UpdateTodoTextInput = {
  id: Scalars['ID'];
  text: Scalars['String'];
};

export type UpdateTodoTextResult = UpdateTodoTextSuccess | UpdateTodoTextFailure;

export type UpdateTodoTextSuccess = {
  __typename?: 'UpdateTodoTextSuccess';
  todo: Todo;
};
