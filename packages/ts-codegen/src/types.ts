import { DirectiveNode } from "graphql";

export type DefinitionImport = {
  from: string;
  defs: { typeName: string }[];
  importName: string;
  directive: DirectiveNode;
};

export type DefinitionModel = {
  typeName: string;
  modelName: string;
  tsType: string;
  from: string | null;
  importName: string | null;
  directive: DirectiveNode;
  modelScope: string | null;
  on: "ObjectTypeDefinition" | "ScalarTypeDefinition";
};

type ContextSubTypeItem = {
  [subType: string]: {
    importNamespaceName?: string;
    importPath: string;
    typeName: string;
  };
};

type ContextGroupItem = {
  [namespace: string]: string[];
};

type ContextGroup = {
  required?: ContextGroupItem;
  useLegacy?: boolean;
};

export type ContextTypeExtension = {
  baseContextTypeName?: string;
  baseContextTypePath?: string;
  legacyBaseContextTypeName?: string;
  legacyBaseContextTypePath?: string;
  groups?: { [group: string]: ContextGroup };
  contextTypes: { [namespace: string]: ContextSubTypeItem };
};
