import {
  GraphQLList,
  GraphQLNonNull,
  GraphQLID,
  GraphQLString,
  GraphQLInt,
  GraphQLFloat,
  GraphQLBoolean,
  GraphQLInputObjectType,
} from "graphql";
import {
  Resolvers,
  ObjectTypeResolver,
  InterfaceTypeResolver,
  UnionTypeResolver,
  InputObjectTypeResolver,
} from "@graphitation/supermassive";
const Query: ObjectTypeResolver = {};
const Mutation: ObjectTypeResolver = {};
const Subscription: ObjectTypeResolver = {};
const Todo: ObjectTypeResolver = {};
const CreateTodoResult: UnionTypeResolver = {
  __types: ["CreateTodoSuccess", "CreateTodoFailure"],
  __resolveType: undefined,
};
const CreateTodoInput: InputObjectTypeResolver = new GraphQLInputObjectType({
  name: "CreateTodoInput",
  description: "",
  fields: () => ({
    text: {
      type: new GraphQLNonNull(GraphQLString),
      description: "",
    },
  }),
});
const CreateTodoSuccess: ObjectTypeResolver = {};
const CreateTodoFailure: ObjectTypeResolver = {};
const UpdateTodoTextResult: UnionTypeResolver = {
  __types: ["UpdateTodoTextSuccess", "UpdateTodoTextFailure"],
  __resolveType: undefined,
};
const UpdateTodoTextInput: InputObjectTypeResolver = new GraphQLInputObjectType(
  {
    name: "UpdateTodoTextInput",
    description: "",
    fields: () => ({
      id: {
        type: new GraphQLNonNull(GraphQLID),
        description: "",
      },
      text: {
        type: new GraphQLNonNull(GraphQLString),
        description: "",
      },
    }),
  }
);
const UpdateTodoTextSuccess: ObjectTypeResolver = {};
const UpdateTodoTextFailure: ObjectTypeResolver = {};
const SetTodoCompletedResult: UnionTypeResolver = {
  __types: ["SetTodoCompletedSuccess", "SetTodoCompletedFailure"],
  __resolveType: undefined,
};
const SetTodoCompletedInput: InputObjectTypeResolver =
  new GraphQLInputObjectType({
    name: "SetTodoCompletedInput",
    description: "",
    fields: () => ({
      id: {
        type: new GraphQLNonNull(GraphQLID),
        description: "",
      },
      isCompleted: {
        type: new GraphQLNonNull(GraphQLBoolean),
        description: "",
      },
    }),
  });
const SetTodoCompletedSuccess: ObjectTypeResolver = {};
const SetTodoCompletedFailure: ObjectTypeResolver = {};
const Failure: InterfaceTypeResolver = {
  __implementedBy: [
    "CreateTodoFailure",
    "UpdateTodoTextFailure",
    "SetTodoCompletedFailure",
  ],
  __resolveType: undefined,
};
export const resolvers: Resolvers = {
  Query,
  Mutation,
  Subscription,
  Todo,
  Failure,
  CreateTodoResult,
  CreateTodoInput,
  CreateTodoSuccess,
  CreateTodoFailure,
  UpdateTodoTextResult,
  UpdateTodoTextInput,
  UpdateTodoTextSuccess,
  UpdateTodoTextFailure,
  SetTodoCompletedResult,
  SetTodoCompletedInput,
  SetTodoCompletedSuccess,
  SetTodoCompletedFailure,
};
