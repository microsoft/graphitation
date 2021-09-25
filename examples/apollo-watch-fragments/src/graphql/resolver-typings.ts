import { GraphQLResolveInfo } from 'graphql';
import { TodoData } from '../db';
export type Maybe<T> = T | null;
export type Exact<T extends { [key: string]: unknown }> = { [K in keyof T]: T[K] };
export type MakeOptional<T, K extends keyof T> = Omit<T, K> & { [SubKey in K]?: Maybe<T[SubKey]> };
export type MakeMaybe<T, K extends keyof T> = Omit<T, K> & { [SubKey in K]: Maybe<T[SubKey]> };
export type Omit<T, K extends keyof T> = Pick<T, Exclude<keyof T, K>>;
export type RequireFields<T, K extends keyof T> = { [X in Exclude<keyof T, K>]?: T[X] } & { [P in K]-?: NonNullable<T[P]> };
/** All built-in and custom scalars, mapped to their actual values */
export type Scalars = {
  ID: string;
  String: string;
  Boolean: boolean;
  Int: number;
  Float: number;
};

export type AddTodoInput = {
  description: Scalars['String'];
};

export type AddTodoPayload = {
  __typename?: 'AddTodoPayload';
  todoEdge?: Maybe<TodosConnectionEdge>;
  todos: TodosConnection;
};

export type ChangeTodoStatusInput = {
  id: Scalars['ID'];
  isCompleted: Scalars['Boolean'];
};

export type ChangeTodoStatusPayload = {
  __typename?: 'ChangeTodoStatusPayload';
  todo: Todo;
  todos: TodosConnection;
};

export type Mutation = {
  __typename?: 'Mutation';
  addTodo?: Maybe<AddTodoPayload>;
  changeTodoStatus?: Maybe<ChangeTodoStatusPayload>;
};


export type MutationAddTodoArgs = {
  input: AddTodoInput;
};


export type MutationChangeTodoStatusArgs = {
  input: ChangeTodoStatusInput;
};

export type Query = {
  __typename?: 'Query';
  todos: TodosConnection;
};

export type Todo = {
  __typename?: 'Todo';
  description: Scalars['String'];
  id: Scalars['ID'];
  isCompleted: Scalars['Boolean'];
};

export type TodosConnection = {
  __typename?: 'TodosConnection';
  edges: Array<TodosConnectionEdge>;
  id: Scalars['ID'];
  totalCount: Scalars['Int'];
  uncompletedCount: Scalars['Int'];
};

export type TodosConnectionEdge = {
  __typename?: 'TodosConnectionEdge';
  node: Todo;
};



export type ResolverTypeWrapper<T> = Promise<T> | T;


export type ResolverWithResolve<TResult, TParent, TContext, TArgs> = {
  resolve: ResolverFn<TResult, TParent, TContext, TArgs>;
};
export type Resolver<TResult, TParent = {}, TContext = {}, TArgs = {}> = ResolverFn<TResult, TParent, TContext, TArgs> | ResolverWithResolve<TResult, TParent, TContext, TArgs>;

export type ResolverFn<TResult, TParent, TContext, TArgs> = (
  parent: TParent,
  args: TArgs,
  context: TContext,
  info: GraphQLResolveInfo
) => Promise<TResult> | TResult;

export type SubscriptionSubscribeFn<TResult, TParent, TContext, TArgs> = (
  parent: TParent,
  args: TArgs,
  context: TContext,
  info: GraphQLResolveInfo
) => AsyncIterator<TResult> | Promise<AsyncIterator<TResult>>;

export type SubscriptionResolveFn<TResult, TParent, TContext, TArgs> = (
  parent: TParent,
  args: TArgs,
  context: TContext,
  info: GraphQLResolveInfo
) => TResult | Promise<TResult>;

export interface SubscriptionSubscriberObject<TResult, TKey extends string, TParent, TContext, TArgs> {
  subscribe: SubscriptionSubscribeFn<{ [key in TKey]: TResult }, TParent, TContext, TArgs>;
  resolve?: SubscriptionResolveFn<TResult, { [key in TKey]: TResult }, TContext, TArgs>;
}

export interface SubscriptionResolverObject<TResult, TParent, TContext, TArgs> {
  subscribe: SubscriptionSubscribeFn<any, TParent, TContext, TArgs>;
  resolve: SubscriptionResolveFn<TResult, any, TContext, TArgs>;
}

export type SubscriptionObject<TResult, TKey extends string, TParent, TContext, TArgs> =
  | SubscriptionSubscriberObject<TResult, TKey, TParent, TContext, TArgs>
  | SubscriptionResolverObject<TResult, TParent, TContext, TArgs>;

export type SubscriptionResolver<TResult, TKey extends string, TParent = {}, TContext = {}, TArgs = {}> =
  | ((...args: any[]) => SubscriptionObject<TResult, TKey, TParent, TContext, TArgs>)
  | SubscriptionObject<TResult, TKey, TParent, TContext, TArgs>;

export type TypeResolveFn<TTypes, TParent = {}, TContext = {}> = (
  parent: TParent,
  context: TContext,
  info: GraphQLResolveInfo
) => Maybe<TTypes> | Promise<Maybe<TTypes>>;

export type IsTypeOfResolverFn<T = {}, TContext = {}> = (obj: T, context: TContext, info: GraphQLResolveInfo) => boolean | Promise<boolean>;

export type NextResolverFn<T> = () => Promise<T>;

export type DirectiveResolverFn<TResult = {}, TParent = {}, TContext = {}, TArgs = {}> = (
  next: NextResolverFn<TResult>,
  parent: TParent,
  args: TArgs,
  context: TContext,
  info: GraphQLResolveInfo
) => TResult | Promise<TResult>;

/** Mapping between all available schema types and the resolvers types */
export type ResolversTypes = {
  AddTodoInput: ResolverTypeWrapper<Partial<AddTodoInput>>;
  AddTodoPayload: ResolverTypeWrapper<Partial<Omit<AddTodoPayload, 'todoEdge' | 'todos'> & { todoEdge?: Maybe<ResolversTypes['TodosConnectionEdge']>, todos: ResolversTypes['TodosConnection'] }>>;
  Boolean: ResolverTypeWrapper<Partial<Scalars['Boolean']>>;
  ChangeTodoStatusInput: ResolverTypeWrapper<Partial<ChangeTodoStatusInput>>;
  ChangeTodoStatusPayload: ResolverTypeWrapper<Partial<Omit<ChangeTodoStatusPayload, 'todo' | 'todos'> & { todo: ResolversTypes['Todo'], todos: ResolversTypes['TodosConnection'] }>>;
  ID: ResolverTypeWrapper<Partial<Scalars['ID']>>;
  Int: ResolverTypeWrapper<Partial<Scalars['Int']>>;
  Mutation: ResolverTypeWrapper<{}>;
  Query: ResolverTypeWrapper<{}>;
  String: ResolverTypeWrapper<Partial<Scalars['String']>>;
  Todo: ResolverTypeWrapper<TodoData>;
  TodosConnection: ResolverTypeWrapper<Partial<Omit<TodosConnection, 'edges'> & { edges: Array<ResolversTypes['TodosConnectionEdge']> }>>;
  TodosConnectionEdge: ResolverTypeWrapper<Partial<Omit<TodosConnectionEdge, 'node'> & { node: ResolversTypes['Todo'] }>>;
};

/** Mapping between all available schema types and the resolvers parents */
export type ResolversParentTypes = {
  AddTodoInput: Partial<AddTodoInput>;
  AddTodoPayload: Partial<Omit<AddTodoPayload, 'todoEdge' | 'todos'> & { todoEdge?: Maybe<ResolversParentTypes['TodosConnectionEdge']>, todos: ResolversParentTypes['TodosConnection'] }>;
  Boolean: Partial<Scalars['Boolean']>;
  ChangeTodoStatusInput: Partial<ChangeTodoStatusInput>;
  ChangeTodoStatusPayload: Partial<Omit<ChangeTodoStatusPayload, 'todo' | 'todos'> & { todo: ResolversParentTypes['Todo'], todos: ResolversParentTypes['TodosConnection'] }>;
  ID: Partial<Scalars['ID']>;
  Int: Partial<Scalars['Int']>;
  Mutation: {};
  Query: {};
  String: Partial<Scalars['String']>;
  Todo: TodoData;
  TodosConnection: Partial<Omit<TodosConnection, 'edges'> & { edges: Array<ResolversParentTypes['TodosConnectionEdge']> }>;
  TodosConnectionEdge: Partial<Omit<TodosConnectionEdge, 'node'> & { node: ResolversParentTypes['Todo'] }>;
};

export type AddTodoPayloadResolvers<ContextType = any, ParentType = ResolversParentTypes['AddTodoPayload']> = {
  todoEdge?: Resolver<Maybe<ResolversTypes['TodosConnectionEdge']>, ParentType, ContextType>;
  todos?: Resolver<ResolversTypes['TodosConnection'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type ChangeTodoStatusPayloadResolvers<ContextType = any, ParentType = ResolversParentTypes['ChangeTodoStatusPayload']> = {
  todo?: Resolver<ResolversTypes['Todo'], ParentType, ContextType>;
  todos?: Resolver<ResolversTypes['TodosConnection'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type MutationResolvers<ContextType = any, ParentType = ResolversParentTypes['Mutation']> = {
  addTodo?: Resolver<Maybe<ResolversTypes['AddTodoPayload']>, ParentType, ContextType, RequireFields<MutationAddTodoArgs, 'input'>>;
  changeTodoStatus?: Resolver<Maybe<ResolversTypes['ChangeTodoStatusPayload']>, ParentType, ContextType, RequireFields<MutationChangeTodoStatusArgs, 'input'>>;
};

export type QueryResolvers<ContextType = any, ParentType = ResolversParentTypes['Query']> = {
  todos?: Resolver<ResolversTypes['TodosConnection'], ParentType, ContextType>;
};

export type TodoResolvers<ContextType = any, ParentType = ResolversParentTypes['Todo']> = {
  description?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  id?: Resolver<ResolversTypes['ID'], ParentType, ContextType>;
  isCompleted?: Resolver<ResolversTypes['Boolean'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type TodosConnectionResolvers<ContextType = any, ParentType = ResolversParentTypes['TodosConnection']> = {
  edges?: Resolver<Array<ResolversTypes['TodosConnectionEdge']>, ParentType, ContextType>;
  id?: Resolver<ResolversTypes['ID'], ParentType, ContextType>;
  totalCount?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  uncompletedCount?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type TodosConnectionEdgeResolvers<ContextType = any, ParentType = ResolversParentTypes['TodosConnectionEdge']> = {
  node?: Resolver<ResolversTypes['Todo'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type Resolvers<ContextType = any> = {
  AddTodoPayload?: AddTodoPayloadResolvers<ContextType>;
  ChangeTodoStatusPayload?: ChangeTodoStatusPayloadResolvers<ContextType>;
  Mutation?: MutationResolvers<ContextType>;
  Query?: QueryResolvers<ContextType>;
  Todo?: TodoResolvers<ContextType>;
  TodosConnection?: TodosConnectionResolvers<ContextType>;
  TodosConnectionEdge?: TodosConnectionEdgeResolvers<ContextType>;
};

