import { DirectiveNode } from "graphql";
import ts from "typescript";

export type DefinitionImport = {
  from: string;
  defs: { typeName: string; modelName: string }[];
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
};
