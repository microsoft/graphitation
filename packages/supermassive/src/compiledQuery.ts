// const query = `{
//     person(id: 1) {
//       name
//       gender
//     }
//   }`;

// const ast = {
//   kind: "Document",
//   definitions: [
//     {
//       kind: "OperationDefinition",
//       operation: "query",
//       name: undefined,
//       variableDefinitions: [],
//       directives: [],
//       selectionSet: {
//         kind: "SelectionSet",
//         selections: [
//           {
//             kind: "Field",
//             alias: undefined,
//             name: {
//               kind: "Name",
//               value: "person",
//               loc: { start: 13, end: 19 },
//             },
//             arguments: [
//               {
//                 kind: "Argument",
//                 name: {
//                   kind: "Name",
//                   value: "id",
//                   loc: { start: 20, end: 22 },
//                 },
//                 value: {
//                   kind: "IntValue",
//                   value: "1",
//                   loc: { start: 24, end: 25 },
//                 },
//                 loc: { start: 20, end: 25 },
//                 __type: {
//                   kind: "NonNullType",
//                   type: {
//                     kind: "NamedType",
//                     name: { kind: "Name", value: "Int" },
//                   },
//                 },
//                 __defaultValue: undefined,
//               },
//             ],
//             directives: [],
//             selectionSet: {
//               kind: "SelectionSet",
//               selections: [
//                 {
//                   kind: "Field",
//                   alias: undefined,
//                   name: {
//                     kind: "Name",
//                     value: "name",
//                     loc: { start: 37, end: 41 },
//                   },
//                   arguments: [],
//                   directives: [],
//                   selectionSet: undefined,
//                   loc: { start: 37, end: 41 },
//                   __type: {
//                     kind: "NamedType",
//                     name: { kind: "Name", value: "String" },
//                   },
//                 },
//                 {
//                   kind: "Field",
//                   alias: undefined,
//                   name: {
//                     kind: "Name",
//                     value: "gender",
//                     loc: { start: 50, end: 56 },
//                   },
//                   arguments: [],
//                   directives: [],
//                   selectionSet: undefined,
//                   loc: { start: 50, end: 56 },
//                   __type: {
//                     kind: "NamedType",
//                     name: { kind: "Name", value: "String" },
//                   },
//                 },
//               ],
//               loc: { start: 27, end: 64 },
//             },
//             loc: { start: 13, end: 64 },
//             __type: {
//               kind: "NamedType",
//               name: { kind: "Name", value: "Person" },
//             },
//           },
//         ],
//         loc: { start: 5, end: 70 },
//       },
//       loc: { start: 5, end: 70 },
//     },
//   ],
//   loc: { start: 0, end: 70 },
// };

// const compiledQuery = (
//   resolvers,
//   rootValue,
//   contextValue,
//   variableValues,
//   operationName,
//   fieldResolver,
//   typeResolver
// ) => {};
