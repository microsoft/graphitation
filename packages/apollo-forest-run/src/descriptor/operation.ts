import type { VariableDefinitionNode, OperationDefinitionNode } from "graphql";
import { valueFromASTUntyped } from "graphql";
import type {
  DocumentDescriptor,
  OperationDescriptor,
  ResultTreeDescriptor,
  OperationEnv,
  TypeName,
  VariableValues,
  VariableName,
} from "./types";
import { sortKeys } from "../jsutils/normalize";

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

export function describeOperation(
  env: OperationEnv,
  documentDescriptor: DocumentDescriptor,
  resultTreeDescriptor: ResultTreeDescriptor,
  variables: VariableValues,
  variablesWithDefaults?: VariableValues,
  variablesKey?: string,
  rootTypeName?: TypeName,
  rootNodeKey?: string,
): OperationDescriptor {
  const {
    definition: { operation, variableDefinitions, directives },
  } = documentDescriptor;

  const effectiveRootTypeName =
    rootTypeName ?? defaultOperationTypes[operation];

  const effectiveRootNodeKey = rootNodeKey ?? defaultRootNodeKeys[operation];

  if (!effectiveRootTypeName) {
    throw new Error(`Unexpected operation type: ${operation}`);
  }

  variablesWithDefaults ??= applyDefaultValues(variables, variableDefinitions);

  return {
    ...documentDescriptor,
    ...resultTreeDescriptor,
    id: env.genId?.() ?? 0,
    env,
    variables,
    variablesWithDefaults,
    rootType: effectiveRootTypeName,
    rootNodeKey: effectiveRootNodeKey,
    selections: new Map(),
    keyVariables: getKeyVars(documentDescriptor.definition),
    variablesKey:
      variablesKey ??
      createVariablesKey(variableDefinitions, variablesWithDefaults),
    cache: Boolean(
      operation !== "mutation" ||
        directives?.some((d) => d.name.value === "cache"),
    ),
  };
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
  for (const variableDef of variableDefinitions) {
    const variableName = variableDef.variable.name.value;
    if (
      variableValues[variableName] !== undefined ||
      variableDef.defaultValue === undefined
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
  return value;
}

export function createVariablesKey(
  defs: ReadonlyArray<VariableDefinitionNode> | undefined,
  variablesWithDefaults: VariableValues,
): string {
  // Note: string concatenation in V8 is fast and memory efficient due to string interning and windowing
  let key = "";
  if (defs?.length) {
    for (const variableDef of defs) {
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
