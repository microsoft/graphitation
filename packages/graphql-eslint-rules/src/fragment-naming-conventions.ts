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
import {
  getMissingLastDirectoryPrefixErrorMessage,
  MISSING_OPERATION_NAME_ERROR_MESSAGE,
  isFilenameSuffixValid,
  isFilenamePrefixValid,
  reportError,
} from "./operation-naming-conventions";

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
        const filename = path.parse(path.basename(filepath)).name;

        if (!isFilenameSuffixValid(filename, ["fragment"])) {
          return reportError(
            context,
            node,
            'Filename should end with the operation name (query/mutation/subscription) e.g. foo-query.graphql OR if the file contains ONLY fragments the suffix can be "fragment" e.g foo-fragment.graphql',
          );
        }

        if (!isFilenamePrefixValid(filename, lastDirectory)) {
          return reportError(
            context,
            node,
            getMissingLastDirectoryPrefixErrorMessage(lastDirectory),
          );
        }

        const pascalFilenameWithoutOperation = cutOperationName(
          pascalCase(path.parse(path.basename(filepath)).name),
        );

        const expectedName = pascalFilenameWithoutOperation.endsWith("Fragment")
          ? pascalFilenameWithoutOperation
          : `${pascalFilenameWithoutOperation}Fragment`;

        const [name, ...optionalSuffix] = documentName.split("_");

        if (expectedName !== name) {
          return reportError(
            context,
            node,
            `Fragment should follow the naming conventions, the expected name is ${expectedName} OR ${expectedName}_optionalSuffix It's possible to chain suffixes using underscore`,
            expectedName,
          );
        }

        if (
          optionalSuffix &&
          optionalSuffix.some(
            (item: string) => !CONDITIONAL_SUFFIX_REGEXP.test(item),
          )
        ) {
          return reportError(
            context,
            node,
            `Fragment should follow the naming conventions, the expected name is ${expectedName} OR ${expectedName}_optionalSuffix It's possible to chain suffixes using underscore`,
            expectedName,
          );
        }
      },
    };
  },
};

export default rule;
