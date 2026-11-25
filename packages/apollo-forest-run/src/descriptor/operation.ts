import type { VariableDefinitionNode, OperationDefinitionNode } from "graphql";
import { valueFromASTUntyped } from "graphql";
import type {
  DetachedFragmentDescriptor,
  DocumentDescriptor,
  FragmentName,
  OperationDescriptor,
  OperationFragmentDescriptor,
  PossibleSelections,
  RegularOperationDescriptor,
  TreeDescriptor,
  ResultTreeDescriptor,
  OperationEnv,
  TypeName,
  VariableValues,
  VariableName,
} from "./types";
import { sortKeys } from "../jsutils/normalize";
import { assert, assertNever } from "../jsutils/assert";

const defaultOperationTypes: Record<
  OperationDefinitionNode["operation"],
  TypeName
> = {
  query: "Query" as TypeName,
  mutation: "Mutation" as TypeName,
  subscription: "Subscription" as TypeName,
};

const defaultRootNodeKeys: Record<
  OperationDefinitionNode["operation"],
  string
> = {
  query: "ROOT_QUERY",
  mutation: "ROOT_MUTATION",
  subscription: "ROOT_SUBSCRIPTION",
};
export const OPERATION_HISTORY_SYMBOL = Symbol("Tree history");

export function describeOperation(
  env: OperationEnv,
  documentDescriptor: DocumentDescriptor,
  resultTreeDescriptor: ResultTreeDescriptor,
  variables: VariableValues,
  variablesWithDefaults?: VariableValues,
  variablesKey?: string,
  rootTypeName?: TypeName,
  rootNodeKey?: string,
): RegularOperationDescriptor {
  const operation = documentDescriptor.definition.operation;
  const rootType = rootTypeName ?? defaultOperationTypes[operation];
  if (!rootType) {
    throw new Error(`Unexpected operation type: ${operation}`);
  }
  const descriptor = createDescriptor(
    "Operation",
    env,
    documentDescriptor,
    resultTreeDescriptor,
    variables,
    variablesWithDefaults,
    variablesKey,
    rootType,
    rootNodeKey,
  );
  assert(descriptor.kind === "Operation");
  return descriptor;
}

/**
 * Describes Apollo fragment document (i.e. `query { ...Fragment }` + fragment definitions).
 *
 * `rootTypeName` is expected to be the type condition of the fragment,
 * `rootNodeKey` - key of the node this fragment is read from / written to (if known).
 */
export function describeDetachedFragment(
  env: OperationEnv,
  documentDescriptor: DocumentDescriptor,
  resultTreeDescriptor: ResultTreeDescriptor,
  variables: VariableValues,
  variablesWithDefaults: VariableValues | undefined,
  variablesKey: string | undefined,
  rootTypeName: TypeName,
  rootNodeKey?: string,
): DetachedFragmentDescriptor {
  const descriptor = createDescriptor(
    "DetachedFragment",
    env,
    documentDescriptor,
    resultTreeDescriptor,
    variables,
    variablesWithDefaults,
    variablesKey,
    rootTypeName,
    rootNodeKey,
  );
  assert(descriptor.kind === "DetachedFragment");
  return descriptor;
}

function createDescriptor(
  kind: OperationDescriptor["kind"],
  env: OperationEnv,
  documentDescriptor: DocumentDescriptor,
  resultTreeDescriptor: ResultTreeDescriptor,
  variables: VariableValues,
  variablesWithDefaults: VariableValues | undefined,
  variablesKey: string | undefined,
  rootType: TypeName,
  rootNodeKey: string | undefined,
): OperationDescriptor {
  const { definition } = documentDescriptor;
  variablesWithDefaults ??= resolveVariablesWithDefaults(
    documentDescriptor,
    variables,
  );
  // Note: keeping evaluation order of helpers (some may throw or call user callbacks)
  const id = env.genId?.() ?? 0;
  const keyVariables = getKeyVars(definition);
  const covers = getCovers(definition, variablesWithDefaults);
  const historySize = env.historyConfig
    ? getHistorySize(definition, variables, env)
    : 0;
  variablesKey ??= createVariablesKey(
    definition.variableDefinitions,
    variablesWithDefaults,
  );

  if (env.optimizeDescriptorShape === false) {
    // Legacy construction (kept for A/B evaluation of optimizeDescriptorShape)
    return {
      kind,
      ...documentDescriptor,
      ...resultTreeDescriptor,
      id,
      name: definition.name?.value,
      env,
      variables,
      variablesWithDefaults,
      rootType,
      rootNodeKey: rootNodeKey ?? defaultRootNodeKeys[definition.operation],
      selections: new Map(),
      keyVariables,
      covers,
      historySize,
      variablesKey,
      cache: isCacheable(definition),
    };
  }
  // Note: explicit literal (vs spreads) keeps all properties in-object with a single shape for all descriptor kinds
  return {
    kind,
    id,
    name: definition.name?.value,
    env,
    document: documentDescriptor.document,
    fragmentMap: documentDescriptor.fragmentMap,
    debugName: documentDescriptor.debugName,
    definition,
    hasDefaultValues: documentDescriptor.hasDefaultValues,
    possibleSelections: resultTreeDescriptor.possibleSelections,
    hasDeferSites: resultTreeDescriptor.hasDeferSites,
    variables,
    variablesWithDefaults,
    variablesKey,
    keyVariables,
    rootType,
    rootNodeKey: rootNodeKey ?? defaultRootNodeKeys[definition.operation],
    selections: new Map(),
    cache: isCacheable(definition),
    historySize,
    covers,
  };
}

/**
 * Describes a fragment of the operation (e.g. a deferred fragment), written to objects with the given
 * `possibleSelections` (selection of the object within the operation).
 *
 * `fragmentName` is set for named fragments (`...Foo`), `typeCondition` - for inline fragments with a type
 * condition (`... on Foo`). Both are undefined for inline fragments without a type condition.
 *
 * The descriptor is not tied to a specific object: all objects with the same fragment may share it.
 */
export function describeOperationFragment(
  env: OperationEnv,
  operation: OperationDescriptor,
  possibleSelections: PossibleSelections,
  fragmentName?: FragmentName,
  typeCondition?: TypeName,
): OperationFragmentDescriptor {
  assert(operation.env === env);
  assert(!fragmentName || !typeCondition);
  return {
    kind: "OperationFragment",
    operation,
    possibleSelections,
    fragmentName,
    typeCondition,
  };
}

// e.g. `query Foo ...Bar`, `query Foo ... on Bar` or just `query Foo` (for inline fragments without type condition)
export function getOperationFragmentDebugName({
  operation,
  fragmentName,
  typeCondition,
}: OperationFragmentDescriptor): string {
  return fragmentName
    ? `${operation.debugName} ...${fragmentName}`
    : typeCondition
    ? `${operation.debugName} ... on ${typeCondition}`
    : operation.debugName;
}

// Operation which owns the selection of the descriptor
export function resolveOperation(
  descriptor: TreeDescriptor,
): OperationDescriptor {
  switch (descriptor.kind) {
    case "Operation":
    case "DetachedFragment":
      return descriptor;
    case "OperationFragment":
      return descriptor.operation;
    default:
      assertNever(descriptor);
  }
}

function resolveVariablesWithDefaults(
  documentDescriptor: DocumentDescriptor,
  variables: VariableValues,
): VariableValues {
  return documentDescriptor.hasDefaultValues
    ? applyDefaultValues(
        variables,
        documentDescriptor.definition.variableDefinitions,
      )
    : variables;
}

function isCacheable(definition: OperationDefinitionNode): boolean {
  return Boolean(
    definition.operation !== "mutation" ||
      definition.directives?.some((d) => d.name.value === "cache"),
  );
}

export function applyDefaultValues(
  variableValues: VariableValues,
  variableDefinitions: readonly VariableDefinitionNode[] | undefined,
): VariableValues {
  if (!variableDefinitions?.length) {
    return variableValues;
  }
  // Note: ideally there should be either variableValue, or vd.defaultValue
  // but there are cases in existing projects where both are undefined 🤷
  // FIXME: throw proper error and fix on the consumer side instead

  let defaultValues: VariableValues | null = null;
  for (let i = 0; i < variableDefinitions.length; i++) {
    const variableDef = variableDefinitions[i];
    const variableName = variableDef.variable.name.value;
    if (
      variableDef.defaultValue === undefined ||
      variableValues[variableName] !== undefined
    ) {
      continue;
    }
    const defaultValue = valueFromASTUntyped(variableDef.defaultValue);
    if (defaultValue === undefined) {
      continue;
    }
    if (!defaultValues) {
      defaultValues = {};
    }
    defaultValues[variableName] = defaultValue;
  }
  return defaultValues
    ? { ...variableValues, ...defaultValues }
    : variableValues;
}

function getKeyVars(doc: OperationDefinitionNode): VariableName[] | null {
  const directive = doc.directives?.find((d) => d.name.value === "cache");
  const astValue = directive?.arguments?.find(
    (arg) => arg.name.value === "keyVars",
  )?.value;
  if (!astValue) {
    return null;
  }
  const value = valueFromASTUntyped(astValue);
  if (
    !Array.isArray(value) ||
    value.some((variable) => typeof variable !== "string")
  ) {
    throw new Error(
      'Could not extract keyVars. Expected directive format: @cache(keyVars=["var1", "var2"]), ' +
        `got ${JSON.stringify(value)} in place of keyVars`,
    );
  }
  return value as string[];
}

const EMPTY_COVERS: string[] = Object.freeze([]) as unknown as string[];

function getCovers(
  doc: OperationDefinitionNode,
  variables: VariableValues,
): string[] {
  const directive = doc.directives?.find((d) => d.name.value === "cache");
  const astValue = directive?.arguments?.find(
    (arg) => arg.name.value === "covers",
  )?.value;
  if (!astValue) {
    return EMPTY_COVERS;
  }
  const value = valueFromASTUntyped(astValue, variables);
  if (
    value === undefined ||
    value === null ||
    (Array.isArray(value) && value.length === 0)
  ) {
    return EMPTY_COVERS;
  }
  if (
    !Array.isArray(value) ||
    value.some((variable) => typeof variable !== "string" || variable === "")
  ) {
    throw new Error(
      'Could not extract covers. Expected directive format: @cache(covers: ["Op1", "Op2"]), ' +
        `got ${JSON.stringify(value)} in place of covers`,
    );
  }
  return value as string[];
}

function getHistorySize(
  doc: OperationDefinitionNode,
  variables: VariableValues,
  env: OperationEnv,
): number {
  const { historyConfig } = env;

  // If overwrittenHistorySize is set, use it (overrides partitioning)
  if (typeof historyConfig?.overwrittenHistorySize === "number") {
    return historyConfig.overwrittenHistorySize;
  }

  if (
    historyConfig &&
    historyConfig?.partitions &&
    historyConfig.partitionKey
  ) {
    const partitionKey = historyConfig.partitionKey(doc, variables);
    if (!partitionKey) {
      return 0;
    }

    const partitionSize = historyConfig.partitions[partitionKey];
    return partitionSize ?? 0;
  }

  return 0;
}

export function createVariablesKey(
  defs: ReadonlyArray<VariableDefinitionNode> | undefined,
  variablesWithDefaults: VariableValues,
): string {
  // Note: string concatenation in V8 is fast and memory efficient due to string interning and windowing
  let key = "";
  if (defs?.length) {
    for (let i = 0; i < defs.length; i++) {
      const variableDef = defs[i];
      const variableName = variableDef.variable.name.value;
      const value = variablesWithDefaults[variableName];
      key += variableName + ":" + JSON.stringify(sortKeys(value)) + ",";
    }
  } else {
    // ApolloCompat: apollo supports writes without variable definitions
    //   TODO: detect existing variables in resultTreeDescriptor
    key = JSON.stringify(sortKeys(variablesWithDefaults));
  }
  return key;
}
