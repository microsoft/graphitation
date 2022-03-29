import {
  GraphQLESLintRule,
  GraphQLESLintRuleContext,
  GraphQLESTreeNode,
} from "@graphql-eslint/eslint-plugin";
import { FragmentDefinitionNode, ASTNode } from "graphql";
import { Kind } from "graphql";
import { relative } from "path";
import { checkDirForPkg } from "./utils";
import path from "path";
import camelCase from "lodash.camelcase";
import { RuleFixer } from "@typescript-eslint/utils/dist/ts-eslint";

const RULE_NAME = "fragment-naming-convention";
const OPERATIONS = ["Query", "Mutation", "Subscription"];
const CONDITIONAL_SUFFIX_REGEXP = /^[a-z]+(?:[A-Z][a-z]+)*$/;

function pascalCase(text: string) {
  const camelCaseText = camelCase(text);
  return camelCaseText.charAt(0).toUpperCase() + camelCaseText.slice(1);
}

function cutOperationName(pascalFilename: string) {
  const operation = OPERATIONS.find((operation) =>
    pascalFilename.endsWith(operation),
  );
  if (operation) {
    return pascalFilename.slice(0, -operation.length);
  }

  return pascalFilename;
}

function reportError(
  context: GraphQLESLintRuleContext,
  node: GraphQLESTreeNode<FragmentDefinitionNode>,
  expectedName: string,
) {
  const newNode = {
    ...node,
    loc: {
      start: {
        line: node.loc.start.line,
        column: node.loc.start.column - 1,
      },
      end: {
        line: node.loc.end.line,
        column: node.loc.end.column - 1,
      },
    },
  };

  context.report({
    node: newNode,
    message: `Fragment should follow the naming conventions, the expected name is ${expectedName} OR ${expectedName}_optionalSuffix It's possible to chain suffixes using underscore`,
    fix(fixer: RuleFixer) {
      if (!expectedName) {
        return;
      }
      return fixer.replaceText(node.name as any, expectedName);
    },
  });
}

const rule: GraphQLESLintRule = {
  meta: {
    type: "problem",
    fixable: "code",
    docs: {
      category: "Operations",
      description: `Enforce more descriptive fragment names`,
      requiresSiblings: true,
      examples: [
        {
          title: "Incorrect",
          code: /* GraphQL */ `
            # packages/eslint-rules-example/image-query.graphql
            fragment Image on User {
              id
              url
            }
          `,
        },
        {
          title: "Correct",
          code: /* GraphQL */ `
            # packages/eslint-rules-example/avatar-query.graphql
            fragment MsTeamsAvatarImage on User {
              id
              url
            }
          `,
        },
      ],
    },
  },
  create(context) {
    return {
      FragmentDefinition(node: GraphQLESTreeNode<FragmentDefinitionNode>) {
        if (!node?.name) return;
        const documentName = node.name.value;
        const filepath = context.getFilename();
        const packageJsonPath = checkDirForPkg(
          path.resolve(process.cwd(), path.dirname(filepath)),
        );

        if (!packageJsonPath || !filepath) {
          return;
        }

        const lastDirectory = path.basename(path.dirname(packageJsonPath));
        const pascalFilenameWithoutOperation = cutOperationName(
          pascalCase(path.parse(path.basename(filepath)).name),
        );
        const expectedPrefix = pascalCase(lastDirectory);

        const expectedName =
          expectedPrefix + pascalFilenameWithoutOperation + "Fragment";

        const [name, ...optionalSuffix] = documentName.split("_");

        if (expectedName !== name) {
          return reportError(context, node, expectedName);
        }

        if (
          optionalSuffix &&
          optionalSuffix.some(
            (item: string) => !CONDITIONAL_SUFFIX_REGEXP.test(item),
          )
        ) {
          return reportError(context, node, expectedName);
        }
      },
    };
  },
};

export default rule;
