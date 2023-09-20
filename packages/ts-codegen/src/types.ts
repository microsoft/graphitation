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
