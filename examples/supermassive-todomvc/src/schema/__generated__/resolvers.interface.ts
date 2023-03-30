/* eslint-disable */
// @ts-nocheck
// This file was automatically generated (by @graphitaiton/supermassive) and should not be edited.
import type { PromiseOrValue } from "@graphitation/supermassive";
import type { ResolveInfo } from "@graphitation/supermassive";
import type {
  TodoModel,
  CreateTodoResultModel,
  UpdateTodoTextResultModel,
  SetTodoCompletedResultModel,
  CreateTodoSuccessModel,
  CreateTodoFailureModel,
  UpdateTodoTextSuccessModel,
  UpdateTodoTextFailureModel,
  SetTodoCompletedSuccessModel,
  SetTodoCompletedFailureModel,
  FailureModel,
} from "./models.interface";
export declare namespace Query {
  export type allTodos = (
    model: unknown,
    args: {},
    context: unknown,
    info: ResolveInfo
  ) => PromiseOrValue<ReadonlyArray<TodoModel>>;
}
export declare namespace Mutation {
  export type createTodo = (
    model: unknown,
    args: {
      input: CreateTodoInput;
    },
    context: unknown,
    info: ResolveInfo
  ) => PromiseOrValue<CreateTodoResultModel>;
  export type updateTodoText = (
    model: unknown,
    args: {
      input: UpdateTodoTextInput;
    },
    context: unknown,
    info: ResolveInfo
  ) => PromiseOrValue<UpdateTodoTextResultModel>;
  export type setTodoCompleted = (
    model: unknown,
    args: {
      input: SetTodoCompletedInput;
    },
    context: unknown,
    info: ResolveInfo
  ) => PromiseOrValue<SetTodoCompletedResultModel>;
}
export declare namespace Subscription {
  export type emitTodos<A = unknown> = {
    subscribe: (
      model: unknown,
      args: {
        limit: number;
      },
      context: unknown,
      info: ResolveInfo
    ) => PromiseOrValue<AsyncIterator<A>>;
    resolve: (
      parent: A,
      args: {
        limit: number;
      },
      context: unknown,
      info: ResolveInfo
    ) => PromiseOrValue<TodoModel | null>;
  };
}
export declare namespace Todo {
  export type id = (
    model: TodoModel,
    args: {},
    context: unknown,
    info: ResolveInfo
  ) => PromiseOrValue<string>;
  export type text = (
    model: TodoModel,
    args: {},
    context: unknown,
    info: ResolveInfo
  ) => PromiseOrValue<string>;
  export type isCompleted = (
    model: TodoModel,
    args: {},
    context: unknown,
    info: ResolveInfo
  ) => PromiseOrValue<boolean>;
}
export type CreateTodoInput = {
  text: string;
};
export declare namespace CreateTodoSuccess {
  export type todo = (
    model: CreateTodoSuccessModel,
    args: {},
    context: unknown,
    info: ResolveInfo
  ) => PromiseOrValue<TodoModel>;
}
export declare namespace CreateTodoFailure {
  export type reason = (
    model: CreateTodoFailureModel,
    args: {},
    context: unknown,
    info: ResolveInfo
  ) => PromiseOrValue<string>;
}
export type UpdateTodoTextInput = {
  id: string;
  text: string;
};
export declare namespace UpdateTodoTextSuccess {
  export type todo = (
    model: UpdateTodoTextSuccessModel,
    args: {},
    context: unknown,
    info: ResolveInfo
  ) => PromiseOrValue<TodoModel>;
}
export declare namespace UpdateTodoTextFailure {
  export type reason = (
    model: UpdateTodoTextFailureModel,
    args: {},
    context: unknown,
    info: ResolveInfo
  ) => PromiseOrValue<string>;
}
export type SetTodoCompletedInput = {
  id: string;
  isCompleted: boolean;
};
export declare namespace SetTodoCompletedSuccess {
  export type todo = (
    model: SetTodoCompletedSuccessModel,
    args: {},
    context: unknown,
    info: ResolveInfo
  ) => PromiseOrValue<TodoModel>;
}
export declare namespace SetTodoCompletedFailure {
  export type reason = (
    model: SetTodoCompletedFailureModel,
    args: {},
    context: unknown,
    info: ResolveInfo
  ) => PromiseOrValue<string>;
}
