/* eslint-disable */ 
// @ts-nocheck 
// This file was automatically generated (by @graphitaiton/supermassive) and should not be edited.
// Base type for all models. Enables automatic resolution of abstract GraphQL types (interfaces, unions)
export interface BaseModel {
    __typename: string;
}
export interface TodoModel extends BaseModel {
    readonly __typename: "Todo";
    readonly id: string;
    readonly text: string;
    readonly isCompleted: boolean;
}
export interface FailureModel extends BaseModel {
    __typename: string;
}
export type CreateTodoResultModel = CreateTodoSuccessModel | CreateTodoFailureModel;
export interface CreateTodoSuccessModel extends BaseModel {
    readonly __typename: "CreateTodoSuccess";
    readonly todo: TodoModel;
}
export interface CreateTodoFailureModel extends BaseModel, FailureModel {
    readonly __typename: "CreateTodoFailure";
    readonly reason: string;
}
export type UpdateTodoTextResultModel = UpdateTodoTextSuccessModel | UpdateTodoTextFailureModel;
export interface UpdateTodoTextSuccessModel extends BaseModel {
    readonly __typename: "UpdateTodoTextSuccess";
    readonly todo: TodoModel;
}
export interface UpdateTodoTextFailureModel extends BaseModel, FailureModel {
    readonly __typename: "UpdateTodoTextFailure";
    readonly reason: string;
}
export type SetTodoCompletedResultModel = SetTodoCompletedSuccessModel | SetTodoCompletedFailureModel;
export interface SetTodoCompletedSuccessModel extends BaseModel {
    readonly __typename: "SetTodoCompletedSuccess";
    readonly todo: TodoModel;
}
export interface SetTodoCompletedFailureModel extends BaseModel, FailureModel {
    readonly __typename: "SetTodoCompletedFailure";
    readonly reason: string;
}
