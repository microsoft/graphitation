// import {
//   ArgumentNode,
//   DirectiveNode,
//   DocumentNode,
//   GraphQLError,
//   visit,
// } from "graphql";
// import { ValueNode } from "graphql/language/ast";

// export type DefinitionModel = {
//   types: string[];
//   field: string,
//   directive: DirectiveNode;
// };

// const MODEL_DIRECTIVE_NAME = "expect";

// export function validateExpectDirective(document: DocumentNode) {
//   visit(document, {
//     Directive(node) {
//       if (node.name.value !== MODEL_DIRECTIVE_NAME) {
//         return;
//       }
//       const types = getArgumentValue(node.arguments, "types");

//       if (types?.kind !== "ListValue") {
//         throw new GraphQLError(
//           `Directive @import requires "types" argument to exist and be a list of strings.`,
//           {
//             nodes: [types ?? node],
//           }
//         );
//       }

//       types.values.forEach((valueNode: ValueNode) => {
//         if (valueNode.kind !== "StringValue") {
//           throw new GraphQLError(
//             `Directive @import requires "types" argument to exist and be a list of strings (got ${valueNode.kind}).`,
//             {
//               nodes: [valueNode],
//             }
//           );
//         }
//     })
//     }

//   });
// }

// const getArgumentValue = (
//   args: readonly ArgumentNode[] = [],
//   name: string
// ): ValueNode | undefined => args.find((arg) => arg.name.value === name)?.value;
