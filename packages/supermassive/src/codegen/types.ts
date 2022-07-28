import { DirectiveNode } from "graphql";
import ts from "typescript";

export type DefinitionImport = {
  from: string;
  defs: string[];
  importName: string;
  directive: DirectiveNode;
};

export type DefinitionModel = {
  tsType: string;
  from: string;
  directive: DirectiveNode;
};

export type DefinitionModels = Map<string, DefinitionModel>;
