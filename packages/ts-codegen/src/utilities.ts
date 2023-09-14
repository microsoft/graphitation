import ts, { factory } from "typescript";
import { ASTNode } from "graphql";
import { TsCodegenContext, UnionType } from "./context";

const MODEL_SUFFIX = "Model";

export function blankGraphQLTag(strings: TemplateStringsArray): string {
  return strings[0];
}

export function getAncestorEntity(
  ancestors: readonly (ASTNode | readonly ASTNode[])[],
  index: number,
): ASTNode | null {
  if (!Array.isArray(ancestors[1])) {
    return null;
  }

  return ancestors[1][index];
}

type ResolverParameterDefinition<T> = { name: string; type: T };
type ResolverParametersDefinitions = {
  parent: ResolverParameterDefinition<ts.TypeReferenceNode>;
  args?: ResolverParameterDefinition<readonly ts.TypeElement[]>;
  context: ResolverParameterDefinition<ts.TypeReferenceNode>;
  resolveInfo: ResolverParameterDefinition<ts.TypeReferenceNode>;
};

export function createUnionResolveType(
  context: TsCodegenContext,
  type: UnionType,
): ts.FunctionTypeNode {
  return factory.createFunctionTypeNode(
    undefined,
    getResolverParameters({
      parent: {
        name: "parent",
        type: factory.createUnionTypeNode(
          type.types.map((name) =>
            context.getModelType(name, "RESOLVERS").toTypeReference(),
          ),
        ) as any,
      },
      context: {
        name: "context",
        type: context.getContextType().toTypeReference(),
      },
      resolveInfo: {
        name: "info",
        type: context.getResolveInfoType().toTypeReference(),
      },
    }),
    factory.createTypeReferenceNode(
      factory.createIdentifier("PromiseOrValue"),
      [
        factory.createUnionTypeNode(
          type.types
            .map((value) =>
              factory.createLiteralTypeNode(factory.createStringLiteral(value)),
            )
            .concat(factory.createLiteralTypeNode(factory.createNull())),
        ),
      ],
    ),
  );
}

export function createInterfaceResolveType(
  context: TsCodegenContext,
): ts.FunctionTypeNode {
  return factory.createFunctionTypeNode(
    undefined,
    getResolverParameters({
      parent: {
        name: "parent",
        type: factory.createTypeReferenceNode("unknown"),
      },
      context: {
        name: "context",
        type: context.getContextType().toTypeReference(),
      },
      resolveInfo: {
        name: "info",
        type: context.getResolveInfoType().toTypeReference(),
      },
    }),
    factory.createTypeReferenceNode(
      factory.createIdentifier("PromiseOrValue"),
      [
        factory.createUnionTypeNode([
          factory.createTypeReferenceNode("string"),
          factory.createLiteralTypeNode(factory.createNull()),
        ]),
      ],
    ),
  );
}

export function getResolverParameters({
  parent,
  args,
  context,
  resolveInfo,
}: ResolverParametersDefinitions) {
  return [
    factory.createParameterDeclaration(
      undefined,
      undefined,
      factory.createIdentifier(parent.name),
      undefined,
      parent.type,
    ),
    args &&
      factory.createParameterDeclaration(
        undefined,
        undefined,
        factory.createIdentifier(args.name),
        undefined,
        factory.createTypeLiteralNode(args.type),
      ),
    factory.createParameterDeclaration(
      undefined,
      undefined,
      factory.createIdentifier(context.name),
      undefined,
      context.type,
    ),
    factory.createParameterDeclaration(
      undefined,
      undefined,
      factory.createIdentifier(resolveInfo.name),
      undefined,
      resolveInfo.type,
    ),
  ].filter(Boolean) as ts.ParameterDeclaration[];
}

export function getSubscriptionResolver(
  typeNode: ts.TypeNode,
  resolverParametersDefinitions: ResolverParametersDefinitions,
  fieldName: string,
): ts.TypeAliasDeclaration {
  const resolverParams = getResolverParameters(resolverParametersDefinitions);
  return factory.createTypeAliasDeclaration(
    [factory.createToken(ts.SyntaxKind.ExportKeyword)],
    factory.createIdentifier(fieldName),
    [
      factory.createTypeParameterDeclaration(
        undefined,
        factory.createIdentifier("SubscribeResult"),
        undefined,
        factory.createKeywordTypeNode(ts.SyntaxKind.NeverKeyword),
      ),
    ],
    factory.createUnionTypeNode([
      factory.createTypeLiteralNode([
        factory.createPropertySignature(
          undefined,
          factory.createIdentifier("subscribe"),
          undefined,
          factory.createFunctionTypeNode(
            undefined,
            resolverParams,
            factory.createTypeReferenceNode(
              factory.createIdentifier("PromiseOrValue"),
              [
                factory.createTypeReferenceNode(
                  factory.createIdentifier("AsyncIterator"),
                  [
                    factory.createTypeLiteralNode([
                      factory.createPropertySignature(
                        undefined,
                        factory.createIdentifier(fieldName),
                        undefined,
                        typeNode,
                      ),
                    ]),
                  ],
                ),
              ],
            ),
          ),
        ),
      ]),
      factory.createTypeLiteralNode([
        factory.createPropertySignature(
          undefined,
          factory.createIdentifier("subscribe"),
          undefined,
          factory.createFunctionTypeNode(
            undefined,
            resolverParams,
            factory.createTypeReferenceNode(
              factory.createIdentifier("PromiseOrValue"),
              [
                factory.createTypeReferenceNode(
                  factory.createIdentifier("AsyncIterator"),
                  [
                    factory.createTypeReferenceNode(
                      factory.createIdentifier("SubscribeResult"),
                      undefined,
                    ),
                  ],
                ),
              ],
            ),
          ),
        ),
        factory.createPropertySignature(
          undefined,
          factory.createIdentifier("resolve"),
          undefined,
          factory.createFunctionTypeNode(
            undefined,
            getResolverParameters({
              ...resolverParametersDefinitions,
              parent: {
                name: "subcribeResult",
                type: factory.createTypeReferenceNode(
                  factory.createIdentifier("SubscribeResult"),
                  undefined,
                ),
              },
            }),
            factory.createTypeReferenceNode(
              factory.createIdentifier("PromiseOrValue"),
              [typeNode],
            ),
          ),
        ),
      ]),
    ]),
  );
}

export function getResolverReturnType(
  typeNode: ts.TypeNode,
  resolverParametersDefinitions: ResolverParametersDefinitions,
) {
  const resolverParams = getResolverParameters(resolverParametersDefinitions);

  return factory.createFunctionTypeNode(
    undefined,
    resolverParams,
    factory.createTypeReferenceNode(
      factory.createIdentifier("PromiseOrValue"),
      [typeNode],
    ),
  );
}

export function createNonNullableTemplate(): ts.Statement[] {
  return [
    factory.createTypeAliasDeclaration(
      undefined,
      factory.createIdentifier("PickNullable"),
      [
        factory.createTypeParameterDeclaration(
          factory.createIdentifier("T"),
          undefined,
          undefined,
        ),
      ],
      factory.createMappedTypeNode(
        undefined,
        factory.createTypeParameterDeclaration(
          undefined,
          factory.createIdentifier("P"),
          factory.createTypeOperatorNode(
            ts.SyntaxKind.KeyOfKeyword,
            factory.createTypeReferenceNode(
              factory.createIdentifier("T"),
              undefined,
            ),
          ),
          undefined,
        ),
        factory.createConditionalTypeNode(
          factory.createLiteralTypeNode(factory.createNull()),
          factory.createIndexedAccessTypeNode(
            factory.createTypeReferenceNode(
              factory.createIdentifier("T"),
              undefined,
            ),
            factory.createTypeReferenceNode(
              factory.createIdentifier("P"),
              undefined,
            ),
          ),
          factory.createTypeReferenceNode(
            factory.createIdentifier("P"),
            undefined,
          ),
          factory.createKeywordTypeNode(ts.SyntaxKind.NeverKeyword),
        ),
        undefined,
        factory.createIndexedAccessTypeNode(
          factory.createTypeReferenceNode(
            factory.createIdentifier("T"),
            undefined,
          ),
          factory.createTypeReferenceNode(
            factory.createIdentifier("P"),
            undefined,
          ),
        ),
        undefined,
      ),
    ),
    factory.createTypeAliasDeclaration(
      undefined,
      factory.createIdentifier("PickNotNullable"),
      [
        factory.createTypeParameterDeclaration(
          undefined,
          factory.createIdentifier("T"),
          undefined,
          undefined,
        ),
      ],
      factory.createMappedTypeNode(
        undefined,
        factory.createTypeParameterDeclaration(
          undefined,
          factory.createIdentifier("P"),
          factory.createTypeOperatorNode(
            ts.SyntaxKind.KeyOfKeyword,
            factory.createTypeReferenceNode(
              factory.createIdentifier("T"),
              undefined,
            ),
          ),
          undefined,
        ),
        factory.createConditionalTypeNode(
          factory.createLiteralTypeNode(factory.createNull()),
          factory.createIndexedAccessTypeNode(
            factory.createTypeReferenceNode(
              factory.createIdentifier("T"),
              undefined,
            ),
            factory.createTypeReferenceNode(
              factory.createIdentifier("P"),
              undefined,
            ),
          ),
          factory.createKeywordTypeNode(ts.SyntaxKind.NeverKeyword),
          factory.createTypeReferenceNode(
            factory.createIdentifier("P"),
            undefined,
          ),
        ),
        undefined,
        factory.createIndexedAccessTypeNode(
          factory.createTypeReferenceNode(
            factory.createIdentifier("T"),
            undefined,
          ),
          factory.createTypeReferenceNode(
            factory.createIdentifier("P"),
            undefined,
          ),
        ),
        undefined,
      ),
    ),
    factory.createTypeAliasDeclaration(
      undefined,
      factory.createIdentifier("OptionalNullable"),
      [
        factory.createTypeParameterDeclaration(
          undefined,
          factory.createIdentifier("T"),
          undefined,
          undefined,
        ),
      ],
      factory.createIntersectionTypeNode([
        factory.createMappedTypeNode(
          undefined,
          factory.createTypeParameterDeclaration(
            undefined,
            factory.createIdentifier("K"),
            factory.createTypeOperatorNode(
              ts.SyntaxKind.KeyOfKeyword,
              factory.createTypeReferenceNode(
                factory.createIdentifier("PickNullable"),
                [
                  factory.createTypeReferenceNode(
                    factory.createIdentifier("T"),
                    undefined,
                  ),
                ],
              ),
            ),
            undefined,
          ),
          undefined,
          factory.createToken(ts.SyntaxKind.QuestionToken),
          factory.createIndexedAccessTypeNode(
            factory.createTypeReferenceNode(
              factory.createIdentifier("PickNullable"),
              [
                factory.createTypeReferenceNode(
                  factory.createIdentifier("T"),
                  undefined,
                ),
              ],
            ),
            factory.createTypeReferenceNode(
              factory.createIdentifier("K"),
              undefined,
            ),
          ),
          undefined,
        ),
        factory.createMappedTypeNode(
          undefined,
          factory.createTypeParameterDeclaration(
            undefined,
            factory.createIdentifier("K"),
            factory.createTypeOperatorNode(
              ts.SyntaxKind.KeyOfKeyword,
              factory.createTypeReferenceNode(
                factory.createIdentifier("PickNotNullable"),
                [
                  factory.createTypeReferenceNode(
                    factory.createIdentifier("T"),
                    undefined,
                  ),
                ],
              ),
            ),
            undefined,
          ),
          undefined,
          undefined,
          factory.createIndexedAccessTypeNode(
            factory.createTypeReferenceNode(
              factory.createIdentifier("PickNotNullable"),
              [
                factory.createTypeReferenceNode(
                  factory.createIdentifier("T"),
                  undefined,
                ),
              ],
            ),
            factory.createTypeReferenceNode(
              factory.createIdentifier("K"),
              undefined,
            ),
          ),
          undefined,
        ),
      ]),
    ),
  ];
}

export function createListType(
  node: ts.TypeNode,
  alsoUndefined?: boolean,
): ts.TypeNode {
  return createNullableType(
    factory.createTypeReferenceNode(factory.createIdentifier("ReadonlyArray"), [
      node,
    ]),
    alsoUndefined,
  );
}

export function createNullableType(
  node: ts.TypeNode,
  alsoUndefined?: boolean,
): ts.UnionTypeNode {
  return factory.createUnionTypeNode(
    [node, factory.createLiteralTypeNode(factory.createNull())].concat(
      alsoUndefined
        ? [factory.createKeywordTypeNode(ts.SyntaxKind.UndefinedKeyword)]
        : [],
    ),
  );
}

export function createNonNullableType(node: ts.TypeNode): ts.TypeNode {
  if (ts.isUnionTypeNode(node)) {
    return node.types[0];
  } else {
    throw new Error(`Can't make type non nullable: ${node}.`);
  }
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
