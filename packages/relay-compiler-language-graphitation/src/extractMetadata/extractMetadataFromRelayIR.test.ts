import { Root } from "relay-compiler";
import { extractMetadataFromRelayIR } from "./extractMetadataFromRelayIR";

const { TestSchema, parseGraphQLText } = require("relay-test-utils-internal");

// const root: Partial<Root> = {
//   argumentDefinitions: [
//     {
//       kind: "LocalArgumentDefinition",
//       name: "avatarSize",
//       type: "ScalarType",
//       defaultValue: 21,
//       metadata: undefined,
//       loc: { kind: "Unknown" },
//     },
//   ],
// };

function parseDefinition(document: string) {
  return parseGraphQLText(TestSchema, document).definitions[0];
}

describe(extractMetadataFromRelayIR, () => {
  it("extracts variables that have default values from operations", () => {
    expect(
      extractMetadataFromRelayIR(
        // Why is this not of kind Request?
        parseDefinition(`
          query Foo($foo: String! = "for sure") {
            me {
              id
            }
          }
        `)
      )
    );
  });

  it("extracts variables that have default values from fragments", () => {
    expect(
      extractMetadataFromRelayIR(
        parseDefinition(`
          fragment Foo on User @argumentDefinitions(foo: { type: "String!", defaultValue: "for sure" }) {
            id
          }
        `)
      )
    );
  });
});
