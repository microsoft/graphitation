import { GraphQLList, GraphQLNonNull, GraphQLID, GraphQLString, GraphQLInt, GraphQLFloat, GraphQLBoolean, GraphQLEnumType, GraphQLInputObjectType } from "graphql";
import { Resolvers, UnionTypeResolver, EnumTypeResolver, ObjectTypeResolver, InterfaceTypeResolver, InputObjectTypeResolver } from "@graphitation/supermassive";
const SearchResult: UnionTypeResolver = { __types: ["Person", "Starship", "Transport", "Species", "Vehicle", "Planet", "Film"], __resolveType: undefined };
const NodeType: EnumTypeResolver = new GraphQLEnumType({ name: "NodeType", description: "", values: { Person: { description: "" }, Starship: { description: "" }, Transport: { description: "" }, Species: { description: "" }, Vehicle: { description: "" }, Planet: { description: "" }, Film: { description: "" } } });
const Subscription: ObjectTypeResolver = {};
const Query: ObjectTypeResolver = {};
const Alive: UnionTypeResolver = { __types: ["Person", "Species"], __resolveType: undefined };
const Film: ObjectTypeResolver = {};
const Vehicle: ObjectTypeResolver = {};
const Person: ObjectTypeResolver = {};
const Starship: ObjectTypeResolver = {};
const Planet: ObjectTypeResolver = {};
const Species: ObjectTypeResolver = {};
const Transport: ObjectTypeResolver = {};
const AdvancedInput: InputObjectTypeResolver = new GraphQLInputObjectType({
    name: "AdvancedInput",
    description: "",
    fields: () => ({
        enumField: {
            type: new GraphQLNonNull(NodeType),
            description: ""
        },
        otherField: {
            type: new GraphQLNonNull(GraphQLString),
            description: ""
        }
    })
});
const Node: InterfaceTypeResolver = { __implementedBy: ["Film", "Vehicle", "Person", "Starship", "Planet", "Species", "Transport"], __resolveType: undefined };
export const resolvers: Resolvers = { SearchResult, NodeType, Subscription, Query, Node, Alive, Film, Vehicle, Person, Starship, Planet, Species, Transport, AdvancedInput };
