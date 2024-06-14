import type { GraphQLESLintRule } from "@graphql-eslint/eslint-plugin";
import { pascalCase, getFileInfo } from "./utils";
import { reportError } from "./operation-naming-conventions";

const OPERATIONS = ["Query", "Mutation", "Subscription"];
const CONDITIONAL_SUFFIX_REGEXP = /^[a-z]+(?:[A-Z][a-z]+)*$/;

function getMissingLastDirectoryPrefixErrorMessage(lastDirectory: string) {
  return `Filename should start with the package directory name: "${lastDirectory}"`;
}

function isFilenamePrefixValid(filename: string, lastDirectory: string) {
  return filename.startsWith(`${lastDirectory}-`);
}

function isFilenameSuffixValid(
  filename: string,
  additionalSuffixes?: string[],
) {
  const operations = additionalSuffixes
    ? [...additionalSuffixes, ...OPERATIONS]
    : OPERATIONS;

  return operations.some((operation) =>
    filename.endsWith(`-${operation.toLowerCase()}`),
  );
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
    schema: [],
    docs: {
      description: `Enforce more descriptive fragment names`,
      category: "Operations",
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
      FragmentDefinition(node) {
        if (!node?.name) {
          return;
        }

        const documentName = node.name.value;
        const fileInfo = getFileInfo(context.getFilename());
        if (!fileInfo) {
          return;
        }

        const { name: filename, directory: lastDirectory } = fileInfo;

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
          pascalCase(filename),
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
