import {
  visit,
  Kind,
  ASTNode,
  TypeDefinitionNode,
  TypeExtensionNode,
  DirectiveDefinitionNode,
  isTypeExtensionNode,
  DocumentNode,
  NameNode,
} from "graphql";
import {
  IMPORT_DIRECTIVE_NAME,
  processImportDirective,
  DefinitionImport,
} from "@graphitation/ts-codegen";
import path from "path";
import { ASTVisitor } from "graphql/language/visitor";
import { typeNameFromAST } from "@graphitation/supermassive";
import { ModuleLoader } from "./moduleLoader";

// How do extends get imported
// 1. If you have extend in entry point, it's always included
// 2. If you are importing a type from a module and it has extends defined or imported for that type, import them
// 3. If you are importing an extend from a module, include it and any other extends for that type that it includes

const BUILT_IN_SCALARS: Set<string> = new Set([
  "ID",
  "Int",
  "Float",
  "String",
  "Boolean",
]);

export type EntryPoint = {
  absolutePath: string;
};

type SymbolName = string;
type AbsolutePath = string;

interface Module {
  absolutePath: AbsolutePath;
  rootPath: AbsolutePath;
  directives: Map<SymbolName, DirectiveDefinitionNode>;
  definitions: Map<SymbolName, TypeDefinitionNode>;
  extensions: Map<SymbolName, TypeExtensionNode[]>;
  importedTypes: Map<SymbolName, DefinitionImport>;
  importedExtensions: Map<SymbolName, DefinitionImport>;
  requiredSymbols: Set<SymbolName>;
  requiredExtensions: Set<SymbolName>;
  missingTypes: Array<SymbolToProcess>;
}

interface SymbolToProcess {
  name: SymbolName;
  module: AbsolutePath;
  isEntryPoint: boolean;
  isExtension: boolean;
  forType?: {
    node?: ASTNode;
    module: AbsolutePath;
  };
}

export type MergeSchemasResult = {
  document: DocumentNode;
  errors?: Array<SymbolToProcess>;
};

export async function mergeSchemas(
  entryPoints: EntryPoint[],
  moduleLoader: ModuleLoader,
): Promise<MergeSchemasResult> {
  const seenSymbols: Array<SymbolToProcess> = [];

  const { symbolsToProcess, modules } = await processEntryPoints(
    moduleLoader,
    entryPoints,
  );

  while (symbolsToProcess.length > 0) {
    const symbolToProcess = symbolsToProcess.pop() as SymbolToProcess;
    seenSymbols.push(symbolToProcess);
    const { name, module, isEntryPoint, forType, isExtension } =
      symbolToProcess;
    if (!modules.has(module)) {
      modules.set(module, createEmptyModule(module));
    }
    const mod = modules.get(module) as Module;
    const potentialNewSymbols: Array<SymbolToProcess> = [];
    if (
      !isExtension &&
      (mod.definitions.has(name) || mod.directives.has(name))
    ) {
      mod.requiredSymbols.add(name);
      const def = (mod.definitions.get(name) || mod.directives.get(name)) as
        | TypeDefinitionNode
        | DirectiveDefinitionNode;
      const newNamesToProcess = processTypeDefinitionOrExtension(def);
      for (const newNameToProcess of newNamesToProcess) {
        potentialNewSymbols.push({
          name: newNameToProcess,
          module,
          isEntryPoint,
          isExtension: false,
          forType: {
            node: def,
            module,
          },
        });
        potentialNewSymbols.push({
          name: newNameToProcess,
          module,
          isEntryPoint,
          isExtension: true,
          forType: {
            node: def,
            module,
          },
        });
      }
    } else if (!isExtension && mod.importedTypes.has(name)) {
      const imp = mod.importedTypes.get(name) as DefinitionImport;
      if (!modules.has(imp.from)) {
        const processedModule = await tryImportModule(moduleLoader, imp.from);
        modules.set(processedModule.absolutePath, processedModule);
      }
      potentialNewSymbols.push({
        name,
        module: imp.from,
        isEntryPoint: false,
        isExtension: false,
        forType,
      });
      // we import the type, so we also import all extensions
      potentialNewSymbols.push({
        name,
        module: imp.from,
        isEntryPoint: false,
        isExtension: true,
        forType,
      });
    } else if (isExtension && mod.extensions.has(name)) {
      mod.requiredExtensions.add(name);
      const defs = mod.extensions.get(name) as TypeExtensionNode[];
      potentialNewSymbols.push({
        name,
        isEntryPoint,
        isExtension: false,
        module,
        forType: {
          node: defs[0],
          module,
        },
      });
      for (const def of defs) {
        const newNamesToProcess = processTypeDefinitionOrExtension(def);
        for (const newNameToProcess of newNamesToProcess) {
          potentialNewSymbols.push({
            name: newNameToProcess,
            module,
            isEntryPoint,
            isExtension: false,
            forType: {
              node: def,
              module,
            },
          });
          potentialNewSymbols.push({
            name: newNameToProcess,
            module,
            isEntryPoint,
            isExtension: true,
            forType: {
              node: def,
              module,
            },
          });
        }
      }
    } else if (isExtension && mod.importedExtensions.has(name)) {
      const imp = mod.importedExtensions.get(name) as DefinitionImport;
      if (!modules.has(imp.from)) {
        const processedModule = await tryImportModule(moduleLoader, imp.from);
        modules.set(processedModule.absolutePath, processedModule);
      }
      potentialNewSymbols.push({
        name,
        module: imp.from,
        isEntryPoint: false,
        isExtension: true,
        forType,
      });
    } else if (!isExtension) {
      mod.missingTypes.push(symbolToProcess);
    }

    for (const newSymbolToProcess of potentialNewSymbols) {
      if (
        shouldProcessSymbol(seenSymbols, symbolsToProcess, newSymbolToProcess)
      ) {
        symbolsToProcess.push(newSymbolToProcess);
      }
    }
  }

  return resultFromModules(modules);
}

async function processEntryPoints(
  moduleLoader: ModuleLoader,
  entryPoints: EntryPoint[],
): Promise<{
  symbolsToProcess: SymbolToProcess[];
  modules: Map<AbsolutePath, Module>;
}> {
  const symbolsToProcess: Array<SymbolToProcess> = [];
  const modules: Map<AbsolutePath, Module> = new Map();

  for (const entryPoint of entryPoints) {
    const { document, rootPath } = await moduleLoader.resolveModuleFromPath(
      entryPoint.absolutePath,
    );
    const processedModule = processModule(
      entryPoint.absolutePath,
      rootPath,
      document,
    );
    modules.set(processedModule.absolutePath, processedModule);
    const names = [
      ...processedModule.definitions.keys(),
      ...processedModule.importedTypes.keys(),
      ...processedModule.directives.keys(),
    ];
    symbolsToProcess.push(
      ...names.map((name) => ({
        name,
        module: processedModule.absolutePath,
        isEntryPoint: true,
        isExtension: false,
        forType: {
          module: processedModule.absolutePath,
        },
      })),
    );
    symbolsToProcess.push(
      ...[
        ...processedModule.extensions.keys(),
        ...processedModule.importedExtensions.keys(),
      ].map((name) => ({
        name,
        module: processedModule.absolutePath,
        isEntryPoint: true,
        isExtension: true,
        forType: {
          module: processedModule.absolutePath,
        },
      })),
    );
  }
  return {
    modules,
    symbolsToProcess,
  };
}

function resultFromModules(
  modules: Map<AbsolutePath, Module>,
): MergeSchemasResult {
  const modulesSorted = Array.from(modules.values()).sort((left, right) =>
    left.absolutePath.localeCompare(right.absolutePath, "en-US"),
  );
  const definitions = [];
  const errors = [];
  for (const mod of modulesSorted) {
    const modDefs: Array<
      TypeDefinitionNode | TypeExtensionNode | DirectiveDefinitionNode
    > = [];
    modDefs.push(
      ...mod.definitions.values(),
      ...mod.directives.values(),
      ...Array.from(mod.extensions.values()).flat(),
    );

    const filteredDefs = modDefs
      .flat()
      .filter((value) => {
        if (value.kind === Kind.DIRECTIVE_DEFINITION) {
          return mod.requiredSymbols.has(`@${value.name.value}`);
        } else if (isTypeExtensionNode(value)) {
          return mod.requiredExtensions.has(value.name.value);
        } else {
          return mod.requiredSymbols.has(value.name.value);
        }
      })
      .sort((left, right) =>
        (left as { name: NameNode }).name.value.localeCompare(
          (right as { name: NameNode }).name.value,
          "en-US",
        ),
      );
    for (const def of filteredDefs) {
      definitions.push(def);
    }
    errors.push(...mod.missingTypes);
  }
  const result: MergeSchemasResult = {
    document: {
      kind: Kind.DOCUMENT,
      definitions,
    },
  };
  if (errors.length > 0) {
    result.errors = errors;
  }
  return result;
}

async function tryImportModule(
  moduleLoader: ModuleLoader,
  absolutePath: AbsolutePath,
): Promise<Module> {
  try {
    const { document, rootPath } = await moduleLoader.resolveModuleFromPath(
      absolutePath,
    );
    return processModule(absolutePath, rootPath, document);
  } catch (e) {
    console.warn(e);
    return createEmptyModule(absolutePath);
  }
}

function processModule(
  absolutePath: string,
  rootPath: string,
  document: DocumentNode,
): Module {
  const result: Module = {
    absolutePath,
    rootPath,
    directives: new Map(),
    definitions: new Map(),
    extensions: new Map(),
    importedTypes: new Map(),
    importedExtensions: new Map(),
    requiredExtensions: new Set(),
    requiredSymbols: new Set(),
    missingTypes: [],
  };
  const visitor: ASTVisitor = {
    [Kind.DIRECTIVE]: {
      enter(node, _key, _parent, _path, _ancestors) {
        if (node.name.value === IMPORT_DIRECTIVE_NAME) {
          const imp = processImportDirective(node, rootPath, rootPath);
          if (imp.from.startsWith(".")) {
            if (!imp.from.endsWith(".graphql")) {
              imp.from = `${imp.from}.graphql`;
            }
            imp.from = path.resolve(rootPath, imp.from);
          }
          imp.defs.forEach(({ typeName }) => {
            result.importedTypes.set(typeName, imp);
          });
          imp.extends.forEach(({ typeName }) => {
            result.importedExtensions.set(typeName, imp);
          });
        }
      },
    },
    [Kind.DIRECTIVE_DEFINITION]: {
      enter(node) {
        result.directives.set(`@${node.name.value}`, node);
      },
    },
  };
  for (const kind of TYPE_DEFINITION_KINDS) {
    visitor[kind] = {
      enter(node: TypeDefinitionNode) {
        result.definitions.set(node.name.value, node);
      },
    };
  }
  for (const kind of TYPE_EXTENSION_KINDS) {
    visitor[kind] = {
      enter(node: TypeExtensionNode) {
        const existing = result.extensions.get(node.name.value) || [];
        existing.push(node);
        result.extensions.set(node.name.value, existing);
      },
    };
  }
  visit(document, visitor);
  return result;
}

function createEmptyModule(absolutePath: AbsolutePath): Module {
  return {
    absolutePath,
    rootPath: absolutePath,
    directives: new Map(),
    definitions: new Map(),
    extensions: new Map(),
    importedTypes: new Map(),
    importedExtensions: new Map(),
    requiredExtensions: new Set(),
    requiredSymbols: new Set(),
    missingTypes: [],
  };
}

function processTypeDefinitionOrExtension(
  def: TypeDefinitionNode | TypeExtensionNode | DirectiveDefinitionNode,
): Array<SymbolName> {
  const result = [];
  if (
    def.kind === Kind.OBJECT_TYPE_DEFINITION ||
    def.kind === Kind.OBJECT_TYPE_EXTENSION ||
    def.kind === Kind.INTERFACE_TYPE_DEFINITION ||
    def.kind === Kind.INTERFACE_TYPE_EXTENSION ||
    def.kind === Kind.INPUT_OBJECT_TYPE_DEFINITION
  ) {
    for (const field of def.fields || []) {
      result.push(typeNameFromAST(field.type));
      if (field.kind === "FieldDefinition") {
        for (const arg of field.arguments || []) {
          result.push(typeNameFromAST(arg.type));
        }
      }
    }
    if (def.kind !== Kind.INPUT_OBJECT_TYPE_DEFINITION) {
      for (const impl of def.interfaces || []) {
        result.push(typeNameFromAST(impl));
      }
    }
  } else if (def.kind === Kind.UNION_TYPE_DEFINITION) {
    for (const branch of def.types || []) {
      result.push(typeNameFromAST(branch));
    }
  } else if (def.kind === Kind.DIRECTIVE_DEFINITION) {
    for (const arg of def.arguments || []) {
      result.push(typeNameFromAST(arg.type));
    }
  }

  if (isTypeExtensionNode(def)) {
    result.push(def.name.value);
  }

  return result;
}

const TYPE_DEFINITION_KINDS = [
  Kind.SCALAR_TYPE_DEFINITION,
  Kind.OBJECT_TYPE_DEFINITION,
  Kind.INTERFACE_TYPE_DEFINITION,
  Kind.UNION_TYPE_DEFINITION,
  Kind.ENUM_TYPE_DEFINITION,
  Kind.INPUT_OBJECT_TYPE_DEFINITION,
];

const TYPE_EXTENSION_KINDS = [
  Kind.SCALAR_TYPE_EXTENSION,
  Kind.OBJECT_TYPE_EXTENSION,
  Kind.INTERFACE_TYPE_EXTENSION,
  Kind.UNION_TYPE_EXTENSION,
  Kind.ENUM_TYPE_EXTENSION,
  Kind.INPUT_OBJECT_TYPE_EXTENSION,
];

function shouldProcessSymbol(
  seenSymbolToProcesss: Array<SymbolToProcess>,
  symbolsToProcess: Array<SymbolToProcess>,
  symbol: SymbolToProcess,
): boolean {
  return (
    !BUILT_IN_SCALARS.has(symbol.name) &&
    !hasType(seenSymbolToProcesss, symbol) &&
    !hasType(symbolsToProcess, symbol)
  );
}

function hasType(
  types: Array<SymbolToProcess>,
  type: SymbolToProcess,
): boolean {
  return !!types.find(
    (value) =>
      value.name === type.name &&
      value.module === type.module &&
      value.isExtension === type.isExtension,
  );
}
