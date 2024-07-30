// https://github.com/dimaMachina/graphql-eslint/blob/master/packages/plugin/src/rules/naming-convention.ts
import { Kind } from "graphql";
import { FromSchema } from "json-schema-to-ts";
import camelCase from "lodash.camelcase";
import lowerCase from "lodash.lowercase";
import {
  GraphQLESLintRule,
  GraphQLESLintRuleListener,
} from "@graphql-eslint/eslint-plugin";

const TYPES_KINDS = [
  Kind.OBJECT_TYPE_DEFINITION,
  Kind.INTERFACE_TYPE_DEFINITION,
  Kind.ENUM_TYPE_DEFINITION,
  Kind.SCALAR_TYPE_DEFINITION,
  Kind.INPUT_OBJECT_TYPE_DEFINITION,
  Kind.UNION_TYPE_DEFINITION,
] as const;

type Truthy<T> = T extends "" | 0 | false | null | undefined ? never : T;

function truthy<T>(value: T): value is Truthy<T> {
  return !!value;
}

const englishJoinWords = (words: string[]): string => words.join(", ");

type CaseStyle =
  | "camelCase"
  | "kebab-case"
  | "PascalCase"
  | "Namespaced_PascalCase"
  | "snake_case"
  | "UPPER_CASE";

const pascalCase = (str: string): string =>
  lowerCase(str)
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join("");

const convertCase = (style: CaseStyle, str: string): string => {
  switch (style) {
    case "camelCase":
      return camelCase(str);
    case "PascalCase":
    case "Namespaced_PascalCase":
      return pascalCase(str);
    case "snake_case":
      return lowerCase(str).replace(/ /g, "_");
    case "UPPER_CASE":
      return lowerCase(str).replace(/ /g, "_").toUpperCase();
    case "kebab-case":
      return lowerCase(str).replace(/ /g, "-");
  }
};

const ARRAY_DEFAULT_OPTIONS = {
  type: "array",
  uniqueItems: true,
  minItems: 1,
  items: {
    type: "string",
  },
} as const;

// FIXME https://github.com/dimaMachina/graphql-eslint/blob/5cb2d8f9048cf86a785db6f816113275571bc7ec/packages/plugin/src/estree-converter/types.ts#L123
type GraphQLESTreeNode = any;

const KindToDisplayName = {
  // types
  [Kind.OBJECT_TYPE_DEFINITION]: "Type",
  [Kind.INTERFACE_TYPE_DEFINITION]: "Interface",
  [Kind.ENUM_TYPE_DEFINITION]: "Enumerator",
  [Kind.SCALAR_TYPE_DEFINITION]: "Scalar",
  [Kind.INPUT_OBJECT_TYPE_DEFINITION]: "Input type",
  [Kind.UNION_TYPE_DEFINITION]: "Union",
  // fields
  [Kind.FIELD_DEFINITION]: "Field",
  [Kind.INPUT_VALUE_DEFINITION]: "Input property",
  [Kind.ARGUMENT]: "Argument",
  [Kind.DIRECTIVE_DEFINITION]: "Directive",
  // rest
  [Kind.ENUM_VALUE_DEFINITION]: "Enumeration value",
  [Kind.OPERATION_DEFINITION]: "Operation",
  [Kind.FRAGMENT_DEFINITION]: "Fragment",
  [Kind.VARIABLE_DEFINITION]: "Variable",
};

type AllowedKind = keyof typeof KindToDisplayName;
type AllowedStyle =
  | "camelCase"
  | "PascalCase"
  | "Namespaced_PascalCase"
  | "snake_case"
  | "UPPER_CASE";

const StyleToRegex: Record<AllowedStyle, RegExp> = {
  camelCase: /^[a-z][\dA-Za-z]*$/,
  PascalCase: /^[A-Z][\dA-Za-z]*$/,
  Namespaced_PascalCase: /^([A-Z][\dA-Za-z]*_)?[A-Z][\dA-Za-z]*$/,
  snake_case: /^[a-z][\d_a-z]*[\da-z]*$/,
  UPPER_CASE: /^[A-Z][\dA-Z_]*[\dA-Z]*$/,
};

const ALLOWED_KINDS = Object.keys(KindToDisplayName).sort() as AllowedKind[];
const ALLOWED_STYLES = Object.keys(StyleToRegex) as AllowedStyle[];

const schemaOption = {
  oneOf: [
    { $ref: "#/definitions/asString" },
    { $ref: "#/definitions/asObject" },
  ],
} as const;

const schema = {
  definitions: {
    asString: {
      enum: ALLOWED_STYLES,
      description: `One of: ${ALLOWED_STYLES.map((t) => `\`${t}\``).join(
        ", ",
      )}`,
    },
    asObject: {
      type: "object",
      additionalProperties: false,
      properties: {
        style: { enum: ALLOWED_STYLES },
        prefix: { type: "string" },
        suffix: { type: "string" },
        forbiddenPrefixes: ARRAY_DEFAULT_OPTIONS,
        forbiddenSuffixes: ARRAY_DEFAULT_OPTIONS,
        requiredPrefixes: ARRAY_DEFAULT_OPTIONS,
        requiredSuffixes: ARRAY_DEFAULT_OPTIONS,
        ignorePattern: {
          type: "string",
          description: "Option to skip validation of some words, e.g. acronyms",
        },
      },
    },
  },
  type: "array",
  maxItems: 1,
  items: {
    type: "object",
    additionalProperties: false,
    properties: {
      types: {
        ...schemaOption,
        description: `Includes:\n${TYPES_KINDS.map(
          (kind) => `- \`${kind}\``,
        ).join("\n")}`,
      },
      ...Object.fromEntries(
        ALLOWED_KINDS.map((kind) => [
          kind,
          {
            ...schemaOption,
            description: `Read more about this kind on [spec.graphql.org](https://spec.graphql.org/October2021/#${kind}).`,
          },
        ]),
      ),
      allowLeadingUnderscore: {
        type: "boolean",
        default: false,
      },
      allowTrailingUnderscore: {
        type: "boolean",
        default: false,
      },
    },
    patternProperties: {
      [`^(${ALLOWED_KINDS.join("|")})(.+)?$`]: schemaOption,
    },
    description: [
      "> It's possible to use a [`selector`](https://eslint.org/docs/developer-guide/selectors) that starts with allowed `ASTNode` names which are described below.",
      ">",
      "> Paste or drop code into the editor in [ASTExplorer](https://astexplorer.net) and inspect the generated AST to compose your selector.",
      ">",
      "> Example: pattern property `FieldDefinition[parent.name.value=Query]` will match only fields for type `Query`.",
    ].join("\n"),
  },
} as const;

export type RuleOptions = FromSchema<typeof schema>;

type PropertySchema = {
  style?: AllowedStyle;
  suffix?: string;
  prefix?: string;
  forbiddenPrefixes?: string[];
  forbiddenSuffixes?: string[];
  requiredPrefixes?: string[];
  requiredSuffixes?: string[];
  ignorePattern?: string;
};

type Options = AllowedStyle | PropertySchema;

const rule: GraphQLESLintRule<RuleOptions> & {
  meta: { hasSuggestions: boolean };
} = {
  meta: {
    type: "suggestion",
    docs: {
      description: "Require names to follow specified conventions.",
      category: ["Schema", "Operations"],
      recommended: true,
      url: "https://the-guild.dev/graphql/eslint/rules/naming-convention",
      examples: [],
      configOptions: {
        schema: [
          {
            types: "PascalCase",
            FieldDefinition: "camelCase",
            InputValueDefinition: "camelCase",
            Argument: "camelCase",
            DirectiveDefinition: "camelCase",
            EnumValueDefinition: "UPPER_CASE",
            "FieldDefinition[parent.name.value=Query]": {
              forbiddenPrefixes: ["query", "get"],
              forbiddenSuffixes: ["Query"],
            },
            "FieldDefinition[parent.name.value=Mutation]": {
              forbiddenPrefixes: ["mutation"],
              forbiddenSuffixes: ["Mutation"],
            },
            "FieldDefinition[parent.name.value=Subscription]": {
              forbiddenPrefixes: ["subscription"],
              forbiddenSuffixes: ["Subscription"],
            },
            "EnumTypeDefinition,EnumTypeExtension": {
              forbiddenPrefixes: ["Enum"],
              forbiddenSuffixes: ["Enum"],
            },
            "InterfaceTypeDefinition,InterfaceTypeExtension": {
              forbiddenPrefixes: ["Interface"],
              forbiddenSuffixes: ["Interface"],
            },
            "UnionTypeDefinition,UnionTypeExtension": {
              forbiddenPrefixes: ["Union"],
              forbiddenSuffixes: ["Union"],
            },
            "ObjectTypeDefinition,ObjectTypeExtension": {
              forbiddenPrefixes: ["Type"],
              forbiddenSuffixes: ["Type"],
            },
          },
        ],
        operations: [
          {
            VariableDefinition: "camelCase",
            OperationDefinition: {
              style: "PascalCase",
              forbiddenPrefixes: ["Query", "Mutation", "Subscription", "Get"],
              forbiddenSuffixes: ["Query", "Mutation", "Subscription"],
            },
            FragmentDefinition: {
              style: "PascalCase",
              forbiddenPrefixes: ["Fragment"],
              forbiddenSuffixes: ["Fragment"],
            },
          },
        ],
      },
    },
    hasSuggestions: true,
    schema,
  },
  create(context) {
    const options = context.options[0] || {};
    const {
      allowLeadingUnderscore,
      allowTrailingUnderscore,
      types,
      ...restOptions
    } = options;

    function normalisePropertyOption(kind: string): PropertySchema {
      const style = (restOptions[kind] || types) as Options;
      return typeof style === "object" ? style : { style };
    }

    function report(
      node: GraphQLESTreeNode,
      message: string,
      suggestedNames: string[],
    ): void {
      context.report({
        node,
        message,
        suggest: suggestedNames.map((suggestedName) => ({
          desc: `Rename to \`${suggestedName}\``,
          fix: (fixer) => fixer.replaceText(node as any, suggestedName),
        })),
      });
    }

    const checkNode = (selector: string) => (n: GraphQLESTreeNode) => {
      const { name: node } =
        n.kind === Kind.VARIABLE_DEFINITION ? n.variable : n;
      if (!node) {
        return;
      }
      const {
        prefix,
        suffix,
        forbiddenPrefixes,
        forbiddenSuffixes,
        style,
        ignorePattern,
        requiredPrefixes,
        requiredSuffixes,
      } = normalisePropertyOption(selector);
      const nodeType = (KindToDisplayName as any)[n.kind] || n.kind;
      const nodeName = node.value;
      const error = getError();
      if (error) {
        const { errorMessage, renameToNames } = error;
        const [leadingUnderscores] = nodeName.match(/^_*/) as RegExpMatchArray;
        const [trailingUnderscores] = nodeName.match(/_*$/) as RegExpMatchArray;
        const suggestedNames = renameToNames.map(
          (renameToName) =>
            leadingUnderscores + renameToName + trailingUnderscores,
        );
        report(
          node,
          `${nodeType} "${nodeName}" should ${errorMessage}`,
          suggestedNames,
        );
      }

      function getError(): {
        errorMessage: string;
        renameToNames: string[];
      } | void {
        const name = nodeName.replace(/(^_+)|(_+$)/g, "");
        // ignore enum value definition exceptions based on enum name, not the value itself
        const ignorePatternTarget =
          n.kind === Kind.ENUM_VALUE_DEFINITION ? n.parent?.name?.value : name;
        if (
          ignorePattern &&
          new RegExp(ignorePattern, "u").test(ignorePatternTarget)
        ) {
          return;
        }

        if (prefix && !name.startsWith(prefix)) {
          return {
            errorMessage: `have "${prefix}" prefix`,
            renameToNames: [prefix + name],
          };
        }
        if (suffix && !name.endsWith(suffix)) {
          return {
            errorMessage: `have "${suffix}" suffix`,
            renameToNames: [name + suffix],
          };
        }
        const forbiddenPrefix = forbiddenPrefixes?.find((prefix) =>
          name.startsWith(prefix),
        );
        if (forbiddenPrefix) {
          return {
            errorMessage: `not have "${forbiddenPrefix}" prefix`,
            renameToNames: [
              name.replace(new RegExp(`^${forbiddenPrefix}`), ""),
            ],
          };
        }
        const forbiddenSuffix = forbiddenSuffixes?.find((suffix) =>
          name.endsWith(suffix),
        );
        if (forbiddenSuffix) {
          return {
            errorMessage: `not have "${forbiddenSuffix}" suffix`,
            renameToNames: [
              name.replace(new RegExp(`${forbiddenSuffix}$`), ""),
            ],
          };
        }
        if (
          requiredPrefixes &&
          !requiredPrefixes.some((requiredPrefix) =>
            name.startsWith(requiredPrefix),
          )
        ) {
          return {
            errorMessage: `have one of the following prefixes: ${englishJoinWords(
              requiredPrefixes,
            )}`,
            renameToNames: style
              ? requiredPrefixes.map((prefix) =>
                  convertCase(style, `${prefix} ${name}`),
                )
              : requiredPrefixes.map((prefix) => `${prefix}${name}`),
          };
        }
        if (
          requiredSuffixes &&
          !requiredSuffixes.some((requiredSuffix) =>
            name.endsWith(requiredSuffix),
          )
        ) {
          return {
            errorMessage: `have one of the following suffixes: ${englishJoinWords(
              requiredSuffixes,
            )}`,
            renameToNames: style
              ? requiredSuffixes.map((suffix) =>
                  convertCase(style, `${name} ${suffix}`),
                )
              : requiredSuffixes.map((suffix) => `${name}${suffix}`),
          };
        }
        // Style is optional
        if (!style) {
          return;
        }
        const caseRegex = StyleToRegex[style];
        if (!caseRegex.test(name)) {
          return {
            errorMessage: `be in ${style} format`,
            renameToNames: [convertCase(style, name)],
          };
        }
      }
    };

    const checkUnderscore =
      (isLeading: boolean) => (node: GraphQLESTreeNode) => {
        const suggestedName = node.value.replace(isLeading ? /^_+/ : /_+$/, "");
        report(
          node,
          `${isLeading ? "Leading" : "Trailing"} underscores are not allowed`,
          [suggestedName],
        );
      };

    const listeners: GraphQLESLintRuleListener = {};

    if (!allowLeadingUnderscore) {
      listeners[
        "Name[value=/^_/]:matches([parent.kind!=Field], [parent.kind=Field][parent.alias])"
      ] = checkUnderscore(true);
    }
    if (!allowTrailingUnderscore) {
      listeners[
        "Name[value=/_$/]:matches([parent.kind!=Field], [parent.kind=Field][parent.alias])"
      ] = checkUnderscore(false);
    }

    const selectors = new Set(
      [types && TYPES_KINDS, Object.keys(restOptions)].flat().filter(truthy),
    );

    for (const selector of selectors) {
      listeners[selector] = checkNode(selector);
    }
    return listeners;
  },
};

export default rule;
