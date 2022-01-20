import { GraphQLList, GraphQLNonNull, GraphQLID, GraphQLString, GraphQLInt, GraphQLFloat, GraphQLBoolean, GraphQLInputObjectType } from "graphql";
const Query = {};
const Mutation = {};
const Subscription = {};
const Todo = {};
const Failure = { __resolveType: undefined };
const CreateTodoResult = { __resolveType: undefined };
const CreateTodoInput = new GraphQLInputObjectType({
    name: "CreateTodoInput",
    description: "",
    fields: () => ({
        text: {
            type: new GraphQLNonNull(GraphQLString),
            description: ""
        }
    })
});
const CreateTodoSuccess = {};
const CreateTodoFailure = {};
const UpdateTodoTextResult = { __resolveType: undefined };
const UpdateTodoTextInput = new GraphQLInputObjectType({
    name: "UpdateTodoTextInput",
    description: "",
    fields: () => ({
        id: {
            type: new GraphQLNonNull(GraphQLID),
            description: ""
        },
        text: {
            type: new GraphQLNonNull(GraphQLString),
            description: ""
        }
    })
});
const UpdateTodoTextSuccess = {};
const UpdateTodoTextFailure = {};
const SetTodoCompletedResult = { __resolveType: undefined };
const SetTodoCompletedInput = new GraphQLInputObjectType({
    name: "SetTodoCompletedInput",
    description: "",
    fields: () => ({
        id: {
            type: new GraphQLNonNull(GraphQLID),
            description: ""
        },
        isCompleted: {
            type: new GraphQLNonNull(GraphQLBoolean),
            description: ""
        }
    })
});
const SetTodoCompletedSuccess = {};
const SetTodoCompletedFailure = {};
export const resolvers = { Query, Mutation, Subscription, Todo, Failure, CreateTodoResult, CreateTodoInput, CreateTodoSuccess, CreateTodoFailure, UpdateTodoTextResult, UpdateTodoTextInput, UpdateTodoTextSuccess, UpdateTodoTextFailure, SetTodoCompletedResult, SetTodoCompletedInput, SetTodoCompletedSuccess, SetTodoCompletedFailure };
