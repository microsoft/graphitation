import { encodeASTSchema } from "../encodeASTSchema";
import { swapiSDL } from "./fixtures/swapiSDL";
import { kitchenSinkSDL } from "./fixtures/kitchenSinkSDL";

describe(encodeASTSchema, () => {
  test("correctly encodes swapi AST schema", () => {
    const encoded = encodeASTSchema(swapiSDL.document);
    expect(encoded).toMatchSnapshot();
  });

  test("correctly encodes kitchen sink AST schema", () => {
    const encoded = encodeASTSchema(kitchenSinkSDL.document);
    expect(encoded).toMatchSnapshot();
  });

  test("correctly encodes kitchen sink AST schema with directives", () => {
    const encoded = encodeASTSchema(kitchenSinkSDL.document);
    expect(encoded).toMatchSnapshot();
  });
});
