// Preserve the v3 testkit's diagnostic, suggestion and autofix snapshots on v4.
// Adapted from https://github.com/graphql-hive/graphql-eslint (MIT).
import { codeFrameColumns } from "@babel/code-frame";
import {
  GraphQLESLintRule,
  parseForESLint,
} from "@graphql-eslint/eslint-plugin";
import { AST, Linter, Rule, RuleTester } from "eslint";

type ValidTestCase<Options> = Omit<RuleTester.ValidTestCase, "options"> & {
  options?: Options;
};
type InvalidTestCase<Options> = ValidTestCase<Options> &
  Pick<RuleTester.InvalidTestCase, "errors" | "output">;

const indentCode = (code: string, indent = 4) =>
  code.replace(/^/gm, " ".repeat(indent));
const trimCode = (code: string) => code.replace(/^\s*\n/, "").trimEnd();

function printCode(
  code: string,
  result: Partial<Linter.LintMessage> = {},
  linesOffset = Number.POSITIVE_INFINITY,
): string {
  const { line, column, endLine, endColumn, message } = result;
  const location: Partial<AST.SourceLocation> = {};
  if (typeof line === "number" && typeof column === "number") {
    location.start = { line, column };
  }
  if (typeof endLine === "number" && typeof endColumn === "number") {
    location.end = { line: endLine, column: endColumn };
  }
  return codeFrameColumns(code, location as AST.SourceLocation, {
    linesAbove: linesOffset,
    linesBelow: linesOffset,
    message,
  });
}

function title(
  text: string,
  index: number,
  total: number,
  description?: string,
): string {
  return (
    text +
    (total > 1 ? ` ${index + 1}/${total}` : "") +
    (description ? `: ${description}` : "")
  );
}

export class GraphQLRuleTester {
  private readonly config = {
    parser: require.resolve("@graphql-eslint/eslint-plugin"),
    parserOptions: { graphQLConfig: {} },
  };
  private readonly tester = new RuleTester(this.config);

  runGraphQLTests<Options, WithTypeInfo extends boolean = false>(
    ruleId: string,
    rule: GraphQLESLintRule<Options, WithTypeInfo>,
    tests: {
      valid: (string | ValidTestCase<Options>)[];
      invalid: InvalidTestCase<Options>[];
    },
  ): void {
    const eslintRule = rule as Rule.RuleModule;
    this.tester.run(ruleId, eslintRule, tests);

    const linter = new Linter();
    linter.defineRule(ruleId, eslintRule);
    linter.defineParser(this.config.parser, { parseForESLint });

    for (const [index, testCase] of tests.invalid.entries()) {
      const { filename, options } = testCase;
      const formattedOptions = options
        ? indentCode(trimCode(JSON.stringify(options, null, 2).slice(1, -1)), 2)
        : undefined;
      const code = trimCode(testCase.code);
      const config: Linter.Config = {
        ...this.config,
        parserOptions: {
          ...this.config.parserOptions,
          ...testCase.parserOptions,
        },
        rules: {
          [ruleId]: ["error", ...(Array.isArray(options) ? options : [])],
        },
      };
      it(`Invalid #${index + 1}`, () => {
        const messages = linter.verify(code, config, filename);
        expect(messages.length).toBeGreaterThan(0);
        const snapshot = [
          "#### \u2328\uFE0F Code",
          indentCode(printCode(code, { line: 0, column: 0 })),
        ];
        if (formattedOptions) {
          snapshot.push("#### \u2699\uFE0F Options", formattedOptions);
        }
        for (const [i, message] of messages.entries()) {
          if (message.fatal) {
            throw new Error(message.message);
          }
          snapshot.push(
            title("#### \u274C Error", i, messages.length),
            indentCode(printCode(code, message, 1)),
          );
          if (message.suggestions && (code.match(/\n/g) || "").length < 1000) {
            for (const [j, suggestion] of message.suggestions.entries()) {
              const { range, text } = suggestion.fix;
              const output =
                code.slice(0, range[0]) + text + code.slice(range[1]);
              snapshot.push(
                title(
                  "#### \u{1F4A1} Suggestion",
                  j,
                  message.suggestions.length,
                  suggestion.desc,
                ),
                indentCode(printCode(output, { line: 0, column: 0 }), 2),
              );
            }
          }
        }
        if (rule.meta.fixable) {
          const { fixed, output } = linter.verifyAndFix(code, config, filename);
          if (fixed) {
            snapshot.push(
              "#### \u{1F527} Autofix output",
              indentCode(printCode(output)),
            );
          }
        }
        expect(snapshot.join("\n\n")).toMatchSnapshot();
      });
    }
  }
}
