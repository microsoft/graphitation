import {
  TypeSystemDefinitionNode,
  TypeSystemExtensionNode,
  visit,
  Kind,
  SchemaExtensionNode,
  isListType,
  ASTNode,
  Visitor,
  TypeDefinitionNode,
  TypeExtensionNode,
  DefinitionNode,
  DirectiveDefinitionNode,
  isTypeExtensionNode,
  getNamedType,
  DocumentNode,
  parse,
  NameNode,
} from "graphql";
import {
  IMPORT_DIRECTIVE_NAME,
  processImportDirective,
  DefinitionImport,
} from "@graphitation/ts-codegen";
import path from "path";
import fs from "fs/promises";
import { ASTVisitor } from "graphql/language/visitor";
import { typeNameFromAST } from "@graphitation/supermassive";
import { ModuleLoader } from "./moduleLoader";

interface EntryPoint {
  absolutePath: string;
}

type TypeName = string;
type AbsolutePath = string;

interface Module {
  absolutePath: AbsolutePath;
  rootPath: AbsolutePath;
  directives: Map<TypeName, DirectiveDefinitionNode>;
  definitions: Map<TypeName, TypeDefinitionNode>;
  extensions: Map<TypeName, TypeExtensionNode[]>;
  importedTypes: Map<TypeName, DefinitionImport>;
  missingTypes: Array<TypeToProcess>;
}

interface TypeToProcess {
  typeName: TypeName;
  module: AbsolutePath;
  isEntryPoint: boolean;
  forType?: {
    node: ASTNode;
    module: AbsolutePath;
  };
}

export async function mergeSchemas(
  entryPoints: EntryPoint[],
  moduleLoader: ModuleLoader,
): Promise<DocumentNode> {
  const usedTypes: Set<TypeName> = new Set();
  const modules: Map<AbsolutePath, Module> = new Map();
  const processedTypes: Array<TypeToProcess> = [];
  const typesToProcess: Array<TypeToProcess> = [];
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
    typesToProcess.push(
      ...Array.from(processedModule.definitions.keys()).map((typeName) => ({
        typeName,
        module: processedModule.absolutePath,
        isEntryPoint: true,
      })),
    );
    typesToProcess.push(
      ...Array.from(processedModule.importedTypes.keys()).map((typeName) => ({
        typeName,
        module: processedModule.absolutePath,
        isEntryPoint: true,
      })),
    );
  }

  while (typesToProcess.length > 0) {
    const typeToProcess = typesToProcess.pop() as TypeToProcess;
    processedTypes.push(typeToProcess);
    const { typeName, module, isEntryPoint, forType } = typeToProcess;
    const mod = modules.get(module);
    if (!mod) {
      throw new Error(`Could not find module: ${module}`);
    }
    if (mod.definitions.has(typeName)) {
      usedTypes.add(typeName);
      const def = mod.definitions.get(typeName) as TypeDefinitionNode;
      const newTypeNamesToProcess = processTypeDefinitionOrExtension(def);
      for (const newTypeNameToProcess of newTypeNamesToProcess) {
        const newTypeToProcess = {
          typeName: newTypeNameToProcess,
          module,
          isEntryPoint,
          forType: {
            node: def,
            module,
          },
        };

        if (
          !hasType(processedTypes, newTypeToProcess) &&
          !hasType(typesToProcess, newTypeToProcess)
        ) {
          typesToProcess.push(newTypeToProcess);
        }
      }
    } else if (mod.importedTypes.has(typeName)) {
      const imp = mod.importedTypes.get(typeName) as DefinitionImport;
      if (!modules.has(imp.from)) {
        const { document, rootPath } = await moduleLoader.resolveModuleFromPath(
          imp.from,
        );
        const processedModule = processModule(imp.from, rootPath, document);
        modules.set(processedModule.absolutePath, processedModule);
      }
      const newTypeToProcess = {
        typeName,
        module: imp.from,
        isEntryPoint: false,
        forType,
      };
      if (
        !hasType(processedTypes, newTypeToProcess) &&
        !hasType(typesToProcess, newTypeToProcess)
      ) {
        typesToProcess.push(newTypeToProcess);
      }
    } else {
      if (forType && !isEntryPoint) {
        mod.missingTypes.push(typeToProcess);
      }
    }
  }

  const modulesSorted = Array.from(modules.values()).sort((left, right) =>
    left.absolutePath.localeCompare(right.absolutePath, "en-US"),
  );
  const definitions = [];
  for (const mod of modulesSorted) {
    const modDefs = Array.from(mod.definitions.values())
      .flat()
      .filter((value) => usedTypes.has(value.name.value))
      .sort((left, right) =>
        (left as { name: NameNode }).name.value.localeCompare(
          (right as { name: NameNode }).name.value,
          "en-US",
        ),
      );
    for (const def of modDefs) {
      definitions.push(def);
    }
  }
  return {
    kind: Kind.DOCUMENT,
    definitions,
  };
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
        }
        // } else if (node.name.value === MODEL_DIRECTIVE_NAME) {
        //   context.addModel(
        //     processModelDirective(node, ancestors, outputPath, documentPath),
        //     node,
        //   );
        // }
      },
    },
    [Kind.DIRECTIVE_DEFINITION]: {
      enter(node) {
        result.directives.set(node.name.value, node);
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

function processTypeDefinitionOrExtension(
  def: TypeDefinitionNode | TypeExtensionNode | DirectiveDefinitionNode,
): Array<TypeName> {
  let result = [];
  if (
    def.kind === Kind.OBJECT_TYPE_DEFINITION ||
    def.kind === Kind.OBJECT_TYPE_EXTENSION ||
    def.kind === Kind.INTERFACE_TYPE_DEFINITION ||
    def.kind === Kind.INTERFACE_TYPE_EXTENSION ||
    def.kind === Kind.INPUT_OBJECT_TYPE_DEFINITION
  ) {
    for (const field of def.fields || []) {
      result.push(typeNameFromAST(field.type));
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
  } else if (isTypeExtensionNode(def)) {
    // TODO: Handle model directives
    return [];
  } else {
    return [];
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

function hasType(types: Array<TypeToProcess>, type: TypeToProcess): boolean {
  return !!types.find(
    (value) => value.typeName === type.typeName && value.module === type.module,
  );
}
