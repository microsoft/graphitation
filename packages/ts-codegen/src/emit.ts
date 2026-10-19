import { GeneratedFile } from "./types";

const join = (items: unknown[] | undefined, separator = "") =>
  (items || []).filter((item) => item != null && item !== "").join(separator);

const modifiers = (items: unknown[] | undefined) => {
  const value = join(items, " ");
  return value ? `${value} ` : "";
};

const block = (items: unknown[] | undefined, indent = "    ") => {
  const value = join(items, "\n");
  return value
    ? value
        .split("\n")
        .map((line) => (line ? indent + line : line))
        .join("\n")
    : "";
};

const emitImplementation = {
  createIdentifier: (value: string) => value,
  createStringLiteral: (value: string) => JSON.stringify(value),
  createNull: () => "null",
  createToken: (kind: string) =>
    ((
      {
        QuestionToken: "?",
        ExportKeyword: "export",
        DeclareKeyword: "declare",
      } as Record<string, string>
    )[kind] || ""),
  createModifier: (kind: string) =>
    ((
      {
        ExportKeyword: "export",
        DeclareKeyword: "declare",
        ReadonlyKeyword: "readonly",
        DefaultKeyword: "default",
      } as Record<string, string>
    )[kind] || kind),
  createKeywordTypeNode: (kind: string) =>
    ((
      {
        StringKeyword: "string",
        UnknownKeyword: "unknown",
        NeverKeyword: "never",
        UndefinedKeyword: "undefined",
      } as Record<string, string>
    )[kind] || kind),
  createTypeReferenceNode: (name: string, args?: unknown[]) =>
    `${name}${args?.length ? `<${join(args, ", ")}>` : ""}`,
  createQualifiedName: (left: string, right: string) => `${left}.${right}`,
  createPropertyAccessExpression: (left: string, right: string) =>
    `${left}.${right}`,
  createLiteralTypeNode: (value: string) => value,
  createUnionTypeNode: (types: unknown[]) => join(types, " | "),
  createIntersectionTypeNode: (types: unknown[]) => join(types, " & "),
  createTypeLiteralNode: (members: unknown[]) =>
    members.length ? `{\n${block(members)}\n}` : "{}",
  createPropertySignature: (
    mods: unknown[] | undefined,
    name: string,
    question: string | undefined,
    type: string,
  ) => `${modifiers(mods)}${name}${question || ""}: ${type};`,
  createParameterDeclaration: (
    _modifiers: unknown,
    _dotDotDot: unknown,
    name: string,
    question: string | undefined,
    type: string,
  ) => `${name}${question || ""}: ${type}`,
  createFunctionTypeNode: (
    _typeParameters: unknown,
    parameters: unknown[],
    type: string,
  ) => `(${join(parameters, ", ")}) => ${type}`,
  createTypeParameterDeclaration: (
    _modifiers: unknown,
    name: string,
    _constraint: unknown,
    defaultType: string,
  ) => `${name} = ${defaultType}`,
  createTypeAliasDeclaration: (
    mods: unknown[],
    name: string,
    typeParameters: unknown[] | undefined,
    type: string,
  ) =>
    `${modifiers(mods)}type ${name}${
      typeParameters?.length ? `<${join(typeParameters, ", ")}>` : ""
    } = ${type};`,
  createInterfaceDeclaration: (
    mods: unknown[],
    name: string,
    _typeParameters: unknown,
    heritage: unknown[] | undefined,
    members: unknown[],
  ) =>
    `${modifiers(mods)}interface ${name}${
      heritage?.length ? ` extends ${join(heritage, ", ")}` : ""
    } ${emit.createTypeLiteralNode(members)}`,
  createExpressionWithTypeArguments: (expression: string) => expression,
  createHeritageClause: (_kind: string, types: unknown[]) => join(types, ", "),
  createEnumMember: (name: string, value: string) => `${name} = ${value},`,
  createEnumDeclaration: (mods: unknown[], name: string, members: unknown[]) =>
    `${modifiers(mods)}enum ${name} {\n${block(
      members.map((member, index) =>
        index === members.length - 1
          ? String(member).replace(/,$/, "")
          : member,
      ),
    )}\n}`,
  createNamedImports: (items: unknown[]) => `{ ${join(items, ", ")} }`,
  createImportSpecifier: (
    _isTypeOnly: boolean,
    alias: string | undefined,
    name: string,
  ) => (alias ? `${alias} as ${name}` : name),
  createNamespaceImport: (name: string) => `* as ${name}`,
  createImportClause: (isTypeOnly: boolean, _default: unknown, named: string) =>
    `${isTypeOnly ? "type " : ""}${named}`,
  createImportDeclaration: (
    _decorators: unknown,
    clause: string,
    module: string,
  ) => `import ${clause} from ${module};`,
  createExportSpecifier: (
    _isTypeOnly: boolean,
    alias: string | undefined,
    name: string,
  ) => (alias ? `${alias} as ${name}` : name),
  createExportDeclaration: (
    _decorators: unknown,
    isTypeOnly: boolean,
    names: string | undefined,
    module: string,
  ) => `export${isTypeOnly ? " type" : ""} ${names || "*"} from ${module};`,
  createNamedExports: (items: unknown[]) => `{ ${join(items, ", ")} }`,
  createModuleBlock: (items: unknown[]) => `{\n${block(items)}\n}`,
  createModuleDeclaration: (mods: unknown[], name: string, body: string) =>
    `${modifiers(mods)}namespace ${name} ${body}`,
  createSourceFile: (statements: unknown[], ..._rest: unknown[]) =>
    ({ content: `${join(statements, "\n")}\n` } as GeneratedFile),
};

export const emit = emitImplementation as unknown as Record<
  string,
  (...args: readonly unknown[]) => string
> & {
  createSourceFile: (
    statements: readonly unknown[],
    ...rest: readonly unknown[]
  ) => GeneratedFile;
};
