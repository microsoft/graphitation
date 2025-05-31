import type { DocumentNode, DefinitionNode } from "graphql";
import type { CacheEnv, Store } from "./types";
import type {
  DocumentDescriptor,
  OperationDescriptor,
  ResultTreeDescriptor,
} from "../descriptor/types";
import { equal } from "@wry/equality";
import { describeDocument } from "../descriptor/document";
import { applyDefaultValues, describeOperation } from "../descriptor/operation";
import { addTypenameToDocument } from "../descriptor/addTypenameToDocument";
import { assert } from "../jsutils/assert";
import { describeResultTree } from "../descriptor/possibleSelection";
import { Cache } from "@apollo/client";
import { VariableValues } from "../descriptor/types";

export const ROOT_TYPES = Object.freeze(["Query", "Mutation", "Subscription"]);
export const ROOT_NODES = Object.freeze([
  "ROOT_QUERY",
  "ROOT_MUTATION",
  "ROOT_SUBSCRIPTION",
]);

const documentCache = new WeakMap<DocumentNode, DocumentNode>();
const reverseDocumentCache = new WeakMap<DocumentNode, DocumentNode>();
const definitionsCache = new WeakMap<DefinitionNode, DefinitionNode>();
const resultTreeDescriptors = new WeakMap<DocumentNode, ResultTreeDescriptor>();
const diffDescriptors = new WeakMap<Cache.DiffOptions, OperationDescriptor>();

export function resolveOperationDescriptor(
  env: CacheEnv,
  { operations, dataForest }: Store,
  doc: DocumentNode,
  variables?: { [key: string]: unknown },
  rootNodeKey?: string,
): OperationDescriptor & { rootNodeKey: string | false } {
  const document = env.addTypename ? transformDocument(doc) : doc;
  const documentDescriptor = describeDocument(document);

  let variants = operations.get(document);
  if (!variants) {
    variants = new Set<OperationDescriptor>();
    operations.set(document, variants);
  }

  let rootTypeName;
  if (isFragmentDocument(document)) {
    const fragment = getFragmentNode(documentDescriptor);
    rootTypeName = fragment.typeCondition.name.value;
  }

  const variablesWithDefaultValues = applyDefaultValues(
    variables ?? {},
    documentDescriptor.definition.variableDefinitions,
  );

  let match: OperationDescriptor | undefined;
  for (const variant of variants) {
    if (
      variablesAreEqual(
        variablesWithDefaultValues,
        variant.variablesWithDefaults,
      ) &&
      (typeof rootNodeKey === "undefined" ||
        variant.rootNodeKey === rootNodeKey)
    ) {
      match = variant;
      break;
    }
  }
  if (!match) {
    let resultTreeDescriptor = resultTreeDescriptors.get(document);
    if (!resultTreeDescriptor) {
      resultTreeDescriptor = describeResultTree(
        documentDescriptor,
        env.possibleTypes,
      );
      resultTreeDescriptors.set(document, resultTreeDescriptor);
    }
    match = describeOperation(
      env,
      documentDescriptor,
      resultTreeDescriptor,
      variables ?? {},
      variablesWithDefaultValues,
      rootTypeName,
      rootNodeKey,
    );
    variants.add(match);
  }
  if (
    typeof rootNodeKey !== "undefined" &&
    !ROOT_NODES.includes(rootNodeKey) &&
    ROOT_TYPES.includes(match.rootType)
  ) {
    match.rootType = dataForest.extraRootIds.get(rootNodeKey) ?? match.rootType;
  }
  return match;
}

export function transformDocument(document: DocumentNode): DocumentNode {
  let result = documentCache.get(document);
  if (!result) {
    const definitions = transformDefinitions(document);
    result =
      document.definitions === definitions
        ? document
        : { ...document, definitions };
    documentCache.set(document, result);
    // If someone calls transformDocument and then mistakenly passes the
    // result back into an API that also calls transformDocument, make sure
    // we don't keep creating new query documents.
    documentCache.set(result, result);
    reverseDocumentCache.set(result, document);
  }
  return result;
}

function transformDefinitions(document: DocumentNode) {
  let dirty = false;
  const definitions = [];
  for (const definition of document.definitions) {
    let processed: any = definitionsCache.get(definition);
    if (!processed) {
      processed = addTypenameToDocument(definition);
      definitionsCache.set(definition, processed);
      definitionsCache.set(processed, processed);
    }
    dirty = dirty || processed !== definition;
    definitions.push(processed);
  }
  return dirty ? definitions : document.definitions;
}

export function getOriginalDocument(
  maybeTransformed: DocumentNode,
): DocumentNode {
  return reverseDocumentCache.get(maybeTransformed) ?? maybeTransformed;
}

export function isFragmentDocument(document: DocumentNode) {
  const operationDefinition = document.definitions[0];
  if (operationDefinition.kind !== "OperationDefinition") {
    return false;
  }
  const selections = operationDefinition.selectionSet.selections;
  return selections.length === 1 && selections[0].kind === "FragmentSpread";
}

export function getFragmentNode(descriptor: DocumentDescriptor) {
  const fragmentSpreadNode = descriptor.definition.selectionSet.selections[0];
  assert(fragmentSpreadNode.kind === "FragmentSpread");

  const fragment = descriptor.fragmentMap.get(fragmentSpreadNode.name.value);
  if (!fragment) {
    throw new Error(`No fragment named ${fragmentSpreadNode.name.value}.`);
  }
  return fragment;
}

export function getDiffDescriptor(
  env: CacheEnv,
  store: Store,
  options: Cache.WatchOptions | Cache.DiffOptions,
): OperationDescriptor {
  // Diff / watch options could be used interchangeably multiple times with the same watch | diff object
  let operationDescriptor = diffDescriptors.get(options);
  if (!operationDescriptor) {
    operationDescriptor = resolveOperationDescriptor(
      env,
      store,
      options.query,
      options.variables as any,
      options.rootId ?? options.id, // ApolloCompat: both variants are used in different scenarios 🤷‍
    );
    diffDescriptors.set(options, operationDescriptor);
  }
  return resolveKeyDescriptor(env, store, operationDescriptor);
}

/**
 * Returned result will be the same as `operation` when `@cache(keyVars: [...])` is not set on document,
 * otherwise - the first found descriptor with matching keyVars
 */
export function resolveKeyDescriptor(
  env: CacheEnv,
  store: Store,
  operation: OperationDescriptor,
): OperationDescriptor {
  if (!operation.keyVariables) {
    return operation;
  }
  const variants = store.operations.get(operation.document);
  assert(variants?.size); // at least `operation` itself is expected to be there

  // Result descriptor is the first registered descriptor with matching key variables
  for (const otherOperation of variants) {
    if (
      otherOperation === operation ||
      variablesAreEqual(
        operation.variablesWithDefaults,
        otherOperation.variablesWithDefaults,
        operation.keyVariables,
      )
    ) {
      return otherOperation;
    }
  }
  assert(false);
}

function variablesAreEqual(
  a: VariableValues,
  b: VariableValues,
  keyVars: string[] | null = null,
): boolean {
  if (!keyVars) {
    return equal(a, b);
  }
  for (const name of keyVars) {
    if (!equal(a[name], b[name])) {
      return false;
    }
  }
  return true;
}
