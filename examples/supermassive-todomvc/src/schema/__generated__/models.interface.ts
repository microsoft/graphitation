// @ts-nocheck 
/* eslint-disable */ 
// This file was automatically generated (by @graphitaiton/supermassive) and should not be edited.
// Base type for all models. Enables automatic resolution of abstract GraphQL types (interfaces, unions)
export interface BaseModel {
    __typename: string;
}
export interface QueryModel extends BaseModel {
    __typename: "Query";
    allTodos: TodoModel[];
}
export interface MutationModel extends BaseModel {
    __typename: "Mutation";
    createTodo: CreateTodoResultModel;
    updateTodoText: UpdateTodoTextResultModel;
    setTodoCompleted: SetTodoCompletedResultModel;
}
export interface SubscriptionModel extends BaseModel {
    __typename: "Subscription";
    emitTodos: TodoModel | null;
}
export interface TodoModel extends BaseModel {
    __typename: "Todo";
    id: string;
    text: string;
    isCompleted: boolean;
}
export interface FailureModel extends BaseModel {
    __typename: string;
}
export type CreateTodoResultModel = CreateTodoSuccessModel | CreateTodoFailureModel;
export interface CreateTodoSuccessModel extends BaseModel {
    __typename: "CreateTodoSuccess";
    todo: TodoModel;
}
export interface CreateTodoFailureModel extends BaseModel, FailureModel {
    __typename: "CreateTodoFailure";
    reason: string;
}
export type UpdateTodoTextResultModel = UpdateTodoTextSuccessModel | UpdateTodoTextFailureModel;
export interface UpdateTodoTextSuccessModel extends BaseModel {
    __typename: "UpdateTodoTextSuccess";
    todo: TodoModel;
}
export interface UpdateTodoTextFailureModel extends BaseModel, FailureModel {
    __typename: "UpdateTodoTextFailure";
    reason: string;
}
export type SetTodoCompletedResultModel = SetTodoCompletedSuccessModel | SetTodoCompletedFailureModel;
export interface SetTodoCompletedSuccessModel extends BaseModel {
    __typename: "SetTodoCompletedSuccess";
    todo: TodoModel;
}
export interface SetTodoCompletedFailureModel extends BaseModel, FailureModel {
    __typename: "SetTodoCompletedFailure";
    reason: string;
}
