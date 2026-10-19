import { emit } from "./emit";
import path from "path";
import { TsCodegenContext, UnionType } from "./context";

const MODEL_SUFFIX = "Model";

export function blankGraphQLTag(strings: TemplateStringsArray): string {
  return strings[0];
}

type ResolverParameterDefinition = { name: string; type: string };
type ResolverParametersDefinitions = {
  parent: ResolverParameterDefinition;
  args?: { name: string; type: string[] };
  context: ResolverParameterDefinition;
  resolveInfo: ResolverParameterDefinition;
};

export function createUnionResolveType(
  context: TsCodegenContext,
  type: UnionType,
  contextType: string,
): string {
  return emit.createFunctionTypeNode(
    undefined,
    getResolverParameters({
      parent: {
        name: "parent",
        type: emit.createUnionTypeNode(
          type.types.map((name) =>
            context.getModelType(name, "RESOLVERS").toTypeReference(),
          ),
        ) as any,
      },
      context: {
        name: "context",
        type: contextType,
      },
      resolveInfo: {
        name: "info",
        type: context.getResolveInfoType().toTypeReference(),
      },
    }),
    emit.createTypeReferenceNode("PromiseOrValue", [
      emit.createUnionTypeNode(
        type.types
          .map((value) =>
            emit.createLiteralTypeNode(emit.createStringLiteral(value)),
          )
          .concat(emit.createLiteralTypeNode(emit.createNull())),
      ),
    ]),
  );
}

export function createInterfaceResolveType(
  context: TsCodegenContext,
  contextType: string,
): string {
  return emit.createFunctionTypeNode(
    undefined,
    getResolverParameters({
      parent: {
        name: "parent",
        type: emit.createTypeReferenceNode("unknown"),
      },
      context: {
        name: "context",
        type: contextType,
      },
      resolveInfo: {
        name: "info",
        type: context.getResolveInfoType().toTypeReference(),
      },
    }),
    emit.createTypeReferenceNode("PromiseOrValue", [
      emit.createUnionTypeNode([
        emit.createTypeReferenceNode("string"),
        emit.createLiteralTypeNode(emit.createNull()),
      ]),
    ]),
  );
}

export function getResolverParameters({
  parent,
  args,
  context,
  resolveInfo,
}: ResolverParametersDefinitions) {
  return [
    emit.createParameterDeclaration(
      undefined,
      undefined,
      parent.name,
      undefined,
      parent.type,
    ),
    args &&
      emit.createParameterDeclaration(
        undefined,
        undefined,
        args.name,
        undefined,
        emit.createTypeLiteralNode(args.type),
      ),
    emit.createParameterDeclaration(
      undefined,
      undefined,
      context.name,
      undefined,
      context.type,
    ),
    emit.createParameterDeclaration(
      undefined,
      undefined,
      resolveInfo.name,
      undefined,
      resolveInfo.type,
    ),
  ].filter(Boolean) as string[];
}

export function getSubscriptionResolver(
  typeNode: string,
  resolverParametersDefinitions: ResolverParametersDefinitions,
  fieldName: string,
): string {
  const resolverParams = getResolverParameters(resolverParametersDefinitions);
  return emit.createTypeAliasDeclaration(
    [emit.createToken("ExportKeyword")],
    fieldName,
    [
      emit.createTypeParameterDeclaration(
        undefined,
        "SubscribeResult",
        undefined,
        emit.createKeywordTypeNode("NeverKeyword"),
      ),
    ],
    emit.createUnionTypeNode([
      emit.createTypeLiteralNode([
        emit.createPropertySignature(
          undefined,
          "subscribe",
          undefined,
          emit.createFunctionTypeNode(
            undefined,
            resolverParams,
            emit.createTypeReferenceNode("PromiseOrValue", [
              emit.createTypeReferenceNode("AsyncIterable", [
                emit.createTypeLiteralNode([
                  emit.createPropertySignature(
                    undefined,
                    fieldName,
                    undefined,
                    typeNode,
                  ),
                ]),
              ]),
            ]),
          ),
        ),
      ]),
      emit.createTypeLiteralNode([
        emit.createPropertySignature(
          undefined,
          "subscribe",
          undefined,
          emit.createFunctionTypeNode(
            undefined,
            resolverParams,
            emit.createTypeReferenceNode("PromiseOrValue", [
              emit.createTypeReferenceNode("AsyncIterable", [
                emit.createTypeReferenceNode("SubscribeResult", undefined),
              ]),
            ]),
          ),
        ),
        emit.createPropertySignature(
          undefined,
          "resolve",
          undefined,
          emit.createFunctionTypeNode(
            undefined,
            getResolverParameters({
              ...resolverParametersDefinitions,
              parent: {
                name: "subcribeResult",
                type: emit.createTypeReferenceNode(
                  "SubscribeResult",
                  undefined,
                ),
              },
            }),
            emit.createTypeReferenceNode("PromiseOrValue", [typeNode]),
          ),
        ),
      ]),
    ]),
  );
}

export function getResolverReturnType(
  typeNode: string,
  resolverParametersDefinitions: ResolverParametersDefinitions,
) {
  const resolverParams = getResolverParameters(resolverParametersDefinitions);

  return emit.createFunctionTypeNode(
    undefined,
    resolverParams,
    emit.createTypeReferenceNode("PromiseOrValue", [typeNode]),
  );
}

export function getResolverReturnListType(node: string) {
  return createNullableType(
    emit.createTypeReferenceNode("IterableOrAsyncIterable", [node]),
    true,
  );
}

export function createListType(node: string, alsoUndefined?: boolean): string {
  return createNullableType(
    emit.createTypeReferenceNode("ReadonlyArray", [node]),
    alsoUndefined,
  );
}

export function createNullableType(
  node: string,
  alsoUndefined?: boolean,
): string {
  return emit.createUnionTypeNode(
    [node, emit.createLiteralTypeNode(emit.createNull())].concat(
      alsoUndefined ? [emit.createKeywordTypeNode("UndefinedKeyword")] : [],
    ),
  );
}

export function createNonNullableType(node: string): string {
  let nonNullableNode = node;
  while (
    nonNullableNode.endsWith(" | null") ||
    nonNullableNode.endsWith(" | undefined")
  ) {
    const suffix = nonNullableNode.endsWith(" | null")
      ? " | null"
      : " | undefined";
    nonNullableNode = nonNullableNode.slice(0, -suffix.length);
  }
  return nonNullableNode;
}

export function addModelSuffix(typeName: string) {
  if (typeName.endsWith(MODEL_SUFFIX)) {
    return typeName;
  }

  return `${typeName}${MODEL_SUFFIX}`;
}

export function createVariableNameFromImport(path: string): string {
  return camelCase(
    path
      .replace(/\.\.\//g, "up-")
      .replace(/@/g, "NS-")
      .replace(/\.\//g, "cwd-")
      .replace(/\//g, "-"),
    {
      pascalCase: true,
      preserveConsecutiveUppercase: true,
    },
  );
}

/**
 * Vendored due to jest being unable to cleanly use ESM modules.
 */

/**
 MIT License

 Copyright (c) Sindre Sorhus <sindresorhus@gmail.com> (https://sindresorhus.com)

 Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

 The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

 THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

 */

const UPPERCASE = /[\p{Lu}]/u;
const LOWERCASE = /[\p{Ll}]/u;
const LEADING_CAPITAL = /^[\p{Lu}](?![\p{Lu}])/gu;
const IDENTIFIER = /([\p{Alpha}\p{N}_]|$)/u;
const SEPARATORS = /[_.\- ]+/;

const LEADING_SEPARATORS = new RegExp("^" + SEPARATORS.source);
const SEPARATORS_AND_IDENTIFIER = new RegExp(
  SEPARATORS.source + IDENTIFIER.source,
  "gu",
);
const NUMBERS_AND_IDENTIFIER = new RegExp("\\d+" + IDENTIFIER.source, "gu");

const preserveCamelCase = (
  string: string,
  toLowerCase: (s: string) => string,
  toUpperCase: (s: string) => string,
) => {
  let isLastCharLower = false;
  let isLastCharUpper = false;
  let isLastLastCharUpper = false;

  for (let index = 0; index < string.length; index++) {
    const character = string[index];

    if (isLastCharLower && UPPERCASE.test(character)) {
      string = string.slice(0, index) + "-" + string.slice(index);
      isLastCharLower = false;
      isLastLastCharUpper = isLastCharUpper;
      isLastCharUpper = true;
      index++;
    } else if (
      isLastCharUpper &&
      isLastLastCharUpper &&
      LOWERCASE.test(character)
    ) {
      string = string.slice(0, index - 1) + "-" + string.slice(index - 1);
      isLastLastCharUpper = isLastCharUpper;
      isLastCharUpper = false;
      isLastCharLower = true;
    } else {
      isLastCharLower =
        toLowerCase(character) === character &&
        toUpperCase(character) !== character;
      isLastLastCharUpper = isLastCharUpper;
      isLastCharUpper =
        toUpperCase(character) === character &&
        toLowerCase(character) !== character;
    }
  }

  return string;
};

const preserveConsecutiveUppercase = (
  input: string,
  toLowerCase: (s: string) => string,
) => {
  LEADING_CAPITAL.lastIndex = 0;

  return input.replace(LEADING_CAPITAL, (m1) => toLowerCase(m1));
};

const postProcess = (input: string, toUpperCase: (s: string) => string) => {
  SEPARATORS_AND_IDENTIFIER.lastIndex = 0;
  NUMBERS_AND_IDENTIFIER.lastIndex = 0;

  return input
    .replace(SEPARATORS_AND_IDENTIFIER, (_, identifier) =>
      toUpperCase(identifier),
    )
    .replace(NUMBERS_AND_IDENTIFIER, (m) => toUpperCase(m));
};

export type CamelCaseOptions = {
  /**
   Uppercase the first character: `foo-bar` → `FooBar`.
   @default false
   */
  readonly pascalCase?: boolean;

  /**
   Preserve consecutive uppercase characters: `foo-BAR` → `FooBAR`.
   @default false
   */
  readonly preserveConsecutiveUppercase?: boolean;

  /**
   The locale parameter indicates the locale to be used to convert to upper/lower case according to any locale-specific case mappings. If multiple locales are given in an array, the best available locale is used.
   Setting `locale: false` ignores the platform locale and uses the [Unicode Default Case Conversion](https://unicode-org.github.io/icu/userguide/transforms/casemappings.html#simple-single-character-case-mapping) algorithm.
   Default: The host environment’s current locale.
   @example
   ```
   import camelCase from 'camelcase';
   camelCase('lorem-ipsum', {locale: 'en-US'});
   //=> 'loremIpsum'
   camelCase('lorem-ipsum', {locale: 'tr-TR'});
   //=> 'loremİpsum'
   camelCase('lorem-ipsum', {locale: ['en-US', 'en-GB']});
   //=> 'loremIpsum'
   camelCase('lorem-ipsum', {locale: ['tr', 'TR', 'tr-TR']});
   //=> 'loremİpsum'
   ```
   */
  readonly locale?: false | string | readonly string[];
};

export function camelCase(
  input: string | readonly string[],
  options: CamelCaseOptions,
) {
  if (!(typeof input === "string" || Array.isArray(input))) {
    throw new TypeError("Expected the input to be `string | string[]`");
  }

  options = {
    pascalCase: false,
    preserveConsecutiveUppercase: false,
    ...options,
  };

  if (Array.isArray(input)) {
    input = input
      .map((x) => x.trim())
      .filter((x) => x.length)
      .join("-");
  } else {
    input = input.trim();
  }

  if (input.length === 0) {
    return "";
  }

  const locale = options.locale;
  let toLowerCase;
  let toUpperCase;
  if (locale === false) {
    toLowerCase = (s: string) => s.toLowerCase();
    toUpperCase = (s: string) => s.toUpperCase();
  } else {
    toLowerCase = (s: string) =>
      s.toLocaleLowerCase(locale as string | string[]);
    toUpperCase = (s: string) =>
      s.toLocaleUpperCase(locale as string | string[]);
  }

  if (input.length === 1) {
    if (SEPARATORS.test(input)) {
      return "";
    }

    return options.pascalCase ? toUpperCase(input) : toLowerCase(input);
  }

  const hasUpperCase = input !== toLowerCase(input);

  if (hasUpperCase) {
    input = preserveCamelCase(input, toLowerCase, toUpperCase);
  }

  input = input.replace(LEADING_SEPARATORS, "");
  input = options.preserveConsecutiveUppercase
    ? preserveConsecutiveUppercase(input, toLowerCase)
    : toLowerCase(input);

  if (options.pascalCase) {
    input = toUpperCase(input.charAt(0)) + input.slice(1);
  }

  return postProcess(input, toUpperCase);
}

export function getContextPath(
  outputDir: string,
  contextTypePath: string | undefined,
) {
  if (!contextTypePath) {
    return;
  }

  if (!contextTypePath.startsWith(".")) {
    return contextTypePath;
  }

  const contextDir = path.join(process.cwd(), contextTypePath);

  return path
    .relative(outputDir, contextDir)
    .split(path.sep)
    .join(path.posix.sep);
}
