import type { DocumentNode, DefinitionNode } from "graphql";
import type { CacheEnv, CacheKey, Store } from "./types";
import type {
  DocumentDescriptor,
  OperationDescriptor,
  ResultTreeDescriptor,
} from "../descriptor/types";
import { equal } from "@wry/equality";
import { describeDocument } from "../descriptor/document";
import {
  applyDefaultValues,
  createVariablesKey,
  describeOperation,
} from "../descriptor/operation";
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
    variants = new Map<CacheKey, OperationDescriptor>();
    operations.set(document, variants);
  }
  const variablesWithDefaultValues = applyDefaultValues(
    variables ?? {},
    documentDescriptor.definition.variableDefinitions,
  );
  const variablesKey = createVariablesKey(
    documentDescriptor.definition.variableDefinitions,
    variablesWithDefaultValues,
  );
  const cacheKey = createCacheKeyImpl(variablesKey, rootNodeKey);

  let match = variants.get(cacheKey);
  if (!match) {
    let resultTreeDescriptor = resultTreeDescriptors.get(document);
    if (!resultTreeDescriptor) {
      resultTreeDescriptor = describeResultTree(
        documentDescriptor,
        env.possibleTypes,
      );
      resultTreeDescriptors.set(document, resultTreeDescriptor);
    }
    let rootTypeName;
    if (isFragmentDocument(document)) {
      const fragment = getFragmentNode(documentDescriptor);
      rootTypeName = fragment.typeCondition.name.value;
    }
    match = describeOperation(
      env,
      documentDescriptor,
      resultTreeDescriptor,
      variables ?? {},
      variablesWithDefaultValues,
      variablesKey,
      rootTypeName,
      rootNodeKey,
    );
    variants.set(cacheKey, match);
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
  return resolveResultDescriptor(env, store, operationDescriptor);
}

/**
 * ApolloCompat: In some cases results of multiple operations may be stored in a single result tree.
 *
 * E.g. when using merge policies for pagination and merging multiple pages into
 * the very first page, all other pages should not be stored separately
 * (otherwise updates become too expensive)
 *
 * This is achieved via `@cache(keyVars: [...])` directive.
 *
 * We still have individual operation descriptors, but only using the very first
 * descriptor with matching keyVariables as a key for result tree.
 */
export function resolveResultDescriptor(
  env: CacheEnv,
  store: Store,
  operation: OperationDescriptor,
): OperationDescriptor {
  if (!operation.keyVariables) {
    return operation;
  }
  const byDocument = store.operations.get(operation.document);
  assert(byDocument?.size); // at least operation itself is expected to be there

  // Result descriptor is the first registered descriptor with matching key variables
  for (const otherOperation of byDocument.values()) {
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

export function variablesAreEqual(
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

export function operationCacheKey(operation: OperationDescriptor): CacheKey {
  return createCacheKeyImpl(operation.variablesKey, operation.rootNodeKey);
}

const createCacheKeyImpl = (
  variablesKey: string,
  rootNodeKey: string | undefined,
) =>
  rootNodeKey === void 0 || ROOT_NODES.includes(rootNodeKey)
    ? variablesKey
    : variablesKey + `{rootNodeKey:${rootNodeKey}}`;
