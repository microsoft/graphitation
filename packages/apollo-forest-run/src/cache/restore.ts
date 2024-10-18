import { Cache, Reference, StoreObject, StoreValue } from "@apollo/client";
import type {
  DocumentNode,
  FragmentDefinitionNode,
  InlineFragmentNode,
  FieldNode,
  OperationDefinitionNode,
  SelectionNode,
  FragmentSpreadNode,
} from "graphql";
import type { NodeKey, TypeName } from "../descriptor/types";
import type {
  SourceCompositeList,
  SourceLeafList,
  SourceNull,
  SourceObject,
  SourceScalar,
} from "../values/types";
import type { CacheEnv } from "./types";
import { Kind, parse, visit } from "graphql";
import { accumulate } from "../jsutils/map";
import { assert } from "../jsutils/assert";
import { isSourceObject } from "../values";

const EMPTY_ARRAY = Object.freeze([]);

// ApolloCompat
//   See also: extract.ts
export function restore(
  env: CacheEnv,
  nodeMap: Record<NodeKey, StoreObject>,
): Cache.WriteOptions[] {
  // Treating contents as a result of one huge query
  // 1. Find all reachable fields from the ROOT_QUERY level
  // 2. All non-reachable root-level fields are likely fragments with individual ids - must be written separately
  //
  // Step 1. Reconstruct query and results
  // First, try to write all roots with a single query
  // Remaining, non-visited keys should be written separately as fragment documents
  const nodesByType = new Map<string, StoreObject[]>(); // Need this to properly generate selections for `null` values
  const nodeFragments = new Map<
    string,
    FragmentDefinitionNode | InlineFragmentNode
  >();
  const fragmentsByName = new Map<string, FragmentDefinitionNode>();
  const visitedKeys = new Set<string>();

  let index = 0;
  for (const [key, node] of Object.entries(nodeMap)) {
    if (key === "__META") {
      continue;
    }
    if (node.__typename) {
      accumulate(nodesByType, node.__typename, node);
    }
    const fragment =
      node.__typename || key === "ROOT_QUERY" || key === "ROOT_SUBSCRIPTION"
        ? createNamedFragmentPlaceholder(key, node, ++index)
        : createInlineFragmentPlaceholder(key, node);

    nodeFragments.set(key, fragment);

    if (fragment.kind === Kind.FRAGMENT_DEFINITION) {
      fragmentsByName.set(fragment.name.value, fragment);
    }
  }

  // Generate inline fragments for typeless nodes first (as they must be fully ready when
  for (const key of Object.keys(nodeMap)) {
    if (key === "__META") {
      continue;
    }
    fillNodeFragment(nodeMap, key, nodeFragments, nodesByType, visitedKeys);
  }

  const writes: Cache.WriteOptions[] = [];
  const visitedQueryKeys = new Set<string>();
  const visitedSubscriptionKeys = new Set<string>();

  if (nodeMap["ROOT_QUERY"]) {
    const data: SourceObject = fromNormalizedObject(
      env,
      nodeMap,
      "ROOT_QUERY",
      visitedQueryKeys,
      [],
    );
    const doc = parse(`query { ...RootQuery }`, noLoc) as any;
    doc.definitions.push(
      ...[...visitedQueryKeys]
        .map((key) => nodeFragments.get(key)!)
        .filter((f) => f.kind !== Kind.INLINE_FRAGMENT),
    );
    writes.push({
      query: doc as DocumentNode,
      result: data,
    });
  }
  if (nodeMap["ROOT_SUBSCRIPTION"]) {
    const data: SourceObject = fromNormalizedObject(
      env,
      nodeMap,
      "ROOT_SUBSCRIPTION",
      visitedSubscriptionKeys,
      [],
    );
    const doc = parse(`subscription { ...RootSubscription }`, noLoc) as any;
    doc.definitions.push(
      ...[...visitedSubscriptionKeys]
        .map((key) => nodeFragments.get(key)!)
        .filter((f) => f.kind !== Kind.INLINE_FRAGMENT),
    );
    writes.push({
      query: doc as DocumentNode,
      result: data,
    });
  }
  // Write remaining keys as fragments
  for (const key of Object.keys(nodeMap)) {
    if (key === "__META") {
      continue;
    }
    if (!visitedQueryKeys.has(key) && !visitedSubscriptionKeys.has(key)) {
      let doc: any;
      const fragment = nodeFragments.get(key)!;

      if (fragment.kind === Kind.FRAGMENT_DEFINITION) {
        doc = parse(`{ ...${fragment.name.value} }`, noLoc);
        doc.definitions.push(fragment);
        doc.definitions.push(
          ...accumulateSpreadedFragments(fragment, fragmentsByName),
        );
      } else {
        doc = parse(`{ __typename }`, noLoc) as any;
        doc.definitions[0].selectionSet.selections = [fragment];
      }

      const data = fromNormalizedObject(
        env,
        nodeMap,
        key,
        visitedQueryKeys,
        [],
      );

      writes.push({
        query: doc,
        result: data,
        dataId: key,
      });
    }
  }

  return writes;
}

function createNamedFragmentPlaceholder(
  key: string,
  node: StoreObject,
  index: number,
) {
  let fragmentName;
  let typeCondition;
  if (key === "ROOT_QUERY") {
    fragmentName = "RootQuery";
    typeCondition = node.__typename ?? "Query";
  } else if (key === "ROOT_SUBSCRIPTION") {
    fragmentName = "RootSubscription";
    typeCondition = node.__typename ?? "Subscription";
  } else {
    assert(node.__typename);
    fragmentName = `${node.__typename}${index}`;
    typeCondition = node.__typename;
  }

  const escapedId = key.replace(/"/g, '\\"');
  const fragment = parse(
    `fragment ${fragmentName} on ${typeCondition} @key(id: "${escapedId}") { __typename }`,
    noLoc,
  ).definitions[0] as FragmentDefinitionNode;

  // Remove __typename: we will add it later if it actually exists in data
  // (had to add __typename in the fragment string above for parse to not throw)
  (fragment.selectionSet.selections as any).length = 0;
  return fragment;
}

function createInlineFragmentPlaceholder(key: string, node: StoreObject) {
  assert(!node.__typename);
  const escapedId = key.replace(/"/g, '\\"');
  const fragment = (
    parse(`{ ... @key(id: "${escapedId}") { __typename } }`, noLoc)
      .definitions[0] as OperationDefinitionNode
  ).selectionSet.selections[0] as InlineFragmentNode;

  // Remove __typename: we will add it later if it actually exists in data
  // (had to add __typename in the fragment string above for parse to not throw)
  (fragment.selectionSet.selections as any).length = 0;
  return fragment;
}

function fillNodeFragment(
  nodeMap: Record<string, StoreObject>,
  key: string,
  nodeFragments: Map<string, FragmentDefinitionNode | InlineFragmentNode>,
  nodesByType: Map<string, StoreObject[]>,
  visitedKeys: Set<string>,
) {
  const value = nodeMap[key];
  const fragment = nodeFragments.get(key);
  assert(isSourceObject(value));
  assert(fragment);

  const typeCondition =
    value.__typename ?? fragment.typeCondition?.name.value ?? "";

  const isComplexField = (fieldPath: string[]) => {
    let valuesAtPath = nodesByType.get(typeCondition) ?? EMPTY_ARRAY;
    for (const field of fieldPath) {
      const argsIndex = field.indexOf("(");
      const fieldNameWithoutArgs =
        argsIndex === -1 ? field : field.substring(0, argsIndex);

      valuesAtPath = valuesAtPath.flatMap((value) => {
        const allKeys = Object.keys(value).filter(
          (key) =>
            key === fieldNameWithoutArgs ||
            key.startsWith(fieldNameWithoutArgs + "(") ||
            key.startsWith(fieldNameWithoutArgs + ":"),
        );
        return allKeys.flatMap(
          (key) => value[key] ?? EMPTY_ARRAY,
        ) as StoreObject[];
      });
    }
    return valuesAtPath.some((value) => isComplexValue(value));
  };

  for (const [cacheFieldKey, fieldValue] of Object.entries(value)) {
    const fieldAST = parseCacheKey(cacheFieldKey);
    (fragment.selectionSet.selections as SelectionNode[]).push(fieldAST);
    addSubSelections(
      value,
      fieldAST,
      cacheFieldKey,
      fieldValue,
      nodeMap,
      nodeFragments,
      isComplexField,
      [cacheFieldKey],
      visitedKeys,
    );
  }
  return fragment;
}

function addSubSelections(
  parent: SourceObject,
  parentField: FieldNode,
  cacheFieldKey: string,
  cacheFieldValue: unknown,
  nodeMap: Record<string, StoreObject>,
  nodeFragments: Map<string, FragmentDefinitionNode | InlineFragmentNode>,
  isComplexField: (path: string[]) => boolean,
  path: string[] = [],
  visitedKeys: Set<string>,
) {
  if (typeof cacheFieldValue !== "object") {
    return;
  }
  if (cacheFieldValue === null) {
    if (isComplexField(path)) {
      addTypeNameOnce(parentField);
    }
    return;
  }
  if (Array.isArray(cacheFieldValue)) {
    if (!cacheFieldValue.length && isComplexField(path)) {
      addTypeNameOnce(parentField);
      return;
    }
    cacheFieldValue.forEach((value) => {
      addSubSelections(
        parent,
        parentField,
        cacheFieldKey,
        value,
        nodeMap,
        nodeFragments,
        isComplexField,
        path,
        visitedKeys,
      );
    });
    return;
  }
  const key: string | undefined = (cacheFieldValue as any)["__ref"];
  if (key) {
    // if (visitedKeys.has(cacheFieldValue["__ref"])) {
    // Break the cycle
    // addTypeNameOnce(parentNode);
    // return;
    // }
    visitedKeys.add(key);

    const node = nodeMap[key];
    const fragment = nodeFragments.get(key);
    assert(isSourceObject(node));
    assert(fragment);

    addSubSelection(
      parentField,
      fragment.kind === Kind.FRAGMENT_DEFINITION
        ? createSpreadNode(fragment.name.value)
        : fragment,
    );
    return;
  }
  assert(isSourceObject(cacheFieldValue));

  // if (!cacheFieldValue.__typename && !isKnownExceptionWithoutTypeName(path)) {
  //   // Most likely custom scalar
  //   return;
  // }

  let inlineFragment: InlineFragmentNode | undefined;

  if (cacheFieldValue.__typename) {
    // Field values may change their type, so always add nested selections in typed inline fragments
    inlineFragment = parentField.selectionSet?.selections.find(
      (sel): sel is InlineFragmentNode =>
        sel.kind === Kind.INLINE_FRAGMENT &&
        sel.typeCondition?.name.value === cacheFieldValue.__typename,
    );
    if (!inlineFragment) {
      inlineFragment = createInlineFragmentNode(cacheFieldValue.__typename);
      addSubSelection(parentField, inlineFragment);
    }
  }

  for (const [fieldKey, fieldValue] of Object.entries(cacheFieldValue)) {
    path.push(fieldKey);
    const subField = parseCacheKey(fieldKey);
    addSubSelections(
      cacheFieldValue,
      subField,
      fieldKey,
      fieldValue,
      nodeMap,
      nodeFragments,
      isComplexField,
      path,
      visitedKeys,
    );
    path.pop();
    addSubSelection(inlineFragment ?? parentField, subField);
  }
}

function addTypeNameOnce(parentNode: FieldNode | InlineFragmentNode) {
  if (
    !parentNode.selectionSet?.selections.some(
      (s) => s.kind === "Field" && s.name.value === "__typename",
    )
  ) {
    addSubSelection(parentNode, createFieldNode("__typename"));
  }
}

function addSubSelection(
  selection: FieldNode | InlineFragmentNode,
  subSelection: SelectionNode,
) {
  if (!selection.selectionSet) {
    (selection.selectionSet as any) = {
      kind: Kind.SELECTION_SET,
      selections: [subSelection],
    };
  } else {
    (selection.selectionSet.selections as any[]).push(subSelection);
  }
}

function isComplexValue(value: any): boolean {
  if (Array.isArray(value)) {
    return value.some((entry) => isComplexValue(entry));
  }
  return (
    typeof value === "object" &&
    value !== null &&
    Boolean(value["__typename"] || value["__ref"])
  );
}

// function isKnownExceptionWithoutTypeName(path: string[]) {
//   if (path[0] === "pinnedChats" && path[1] === "pageInfo") {
//     return true;
//   }
//   return false;
// }

const noLoc = { noLocation: true };

// We need to re-construct the query itself from the normalized store
const indexes = new Map<string, number>();

function parseCacheKey(fullKey: string): FieldNode {
  // const [fieldKey, ...directives] = fullKey.split("@");
  const [fieldKey] = fullKey.split("@");

  // e.g. field({"literal":true,"x":42})
  let match = /^([a-zA-Z0-9_]+)\((.*)\)$/.exec(fieldKey);
  if (!match) {
    // or field:{"literal":true,"x":42} (for case with keyArgs)
    match = /^([a-zA-Z0-9_]+):(\{.*\})$/.exec(fieldKey);
  }
  if (!match) {
    // or field:foo (for case with @connection(key: "foo"))
    match = /^([a-zA-Z0-9_]+):(.*)$/.exec(fieldKey);
  }

  if (!match) {
    return createFieldNode(fieldKey);
  }

  const name = match[1];
  const args = match[2][0] === "{" ? JSON.parse(match[2]) : {};
  const connectionKey = match[2][0] !== "{" ? match[2] : undefined;

  const gqlArgs: string[] = [];
  Object.keys(args).forEach((arg) => {
    const value = args[arg];
    gqlArgs.push(`${arg}: ${stringifyObject(value)}`);
  });
  if (match[2] === "{}") {
    gqlArgs.push("__missing: null");
  }
  const gqlDirectives: string[] = [];
  if (connectionKey) {
    gqlDirectives.push(`@connection(key: "${connectionKey}")`);
  }
  const gqlArgsString = gqlArgs.length ? `(${gqlArgs.join(", ")})` : ``;
  const gqlDirectiveString = gqlDirectives.join(" ");

  let gqlFieldString;
  if (gqlArgs.length) {
    // Need a unique alias per cache key when there are arguments
    let index = indexes.get(fieldKey);
    if (index === undefined) {
      index = indexes.size;
      indexes.set(fieldKey, index);
    }
    gqlFieldString = `{ ${name}_${index}: ${name}${gqlArgsString} ${gqlDirectiveString} }`;
  } else {
    gqlFieldString = `{ ${name} ${gqlDirectiveString} }`;
  }

  const doc = parse(gqlFieldString, noLoc);
  const fieldAST = (doc.definitions[0] as OperationDefinitionNode).selectionSet
    .selections[0];

  return fieldAST as FieldNode;
}

function stringifyObject(obj: unknown): string {
  if (obj === null) return "null";
  if (Array.isArray(obj)) {
    const arrayContents = obj.map((item) => stringifyObject(item)).join(", ");
    return `[${arrayContents}]`;
  }
  if (typeof obj === "object") {
    const props = Object.keys(obj)
      .map((key) => {
        const value = stringifyObject((obj as Record<string, unknown>)[key]);
        return `${key}: ${value}`;
      })
      .join(", ");
    return `{ ${props} }`;
  }
  if (typeof obj === "string") {
    return JSON.stringify(obj);
  }
  return String(obj);
}

function createFieldNode(name: string): FieldNode {
  return {
    kind: Kind.FIELD,
    name: {
      kind: Kind.NAME,
      value: name,
    },
    arguments: [],
    directives: [],
  };
}

function createSpreadNode(name: string): FragmentSpreadNode {
  return {
    kind: Kind.FRAGMENT_SPREAD,
    name: {
      kind: Kind.NAME,
      value: name,
    },
    directives: [],
  };
}

function createInlineFragmentNode(typeName: string): InlineFragmentNode {
  return {
    kind: Kind.INLINE_FRAGMENT,
    typeCondition: {
      kind: Kind.NAMED_TYPE,
      name: {
        kind: Kind.NAME,
        value: typeName,
      },
    },
    selectionSet: {
      kind: Kind.SELECTION_SET,
      selections: [],
    },
    directives: [],
  };
}

function fromNormalizedObject(
  env: CacheEnv,
  nodeMap: Record<string, StoreObject>,
  storeObjectOrKey: string | StoreObject,
  visitedKeys: Set<string>,
  keyStack: string[] = [],
): SourceObject {
  if (typeof storeObjectOrKey === "string") {
    if (keyStack.includes(storeObjectOrKey)) {
      // We are in a cycle - break it by returning object with "key fields" only
      const value = nodeMap[storeObjectOrKey];
      const [typeName, id] = storeObjectOrKey.split(":", 2) as [
        TypeName,
        SourceScalar,
      ];
      const typePolicy = env.typePolicies[typeName];

      let keyFields =
        typeof typePolicy?.keyFields === "function"
          ? typePolicy.keyFields(value, { readField: () => undefined } as any)
          : typePolicy?.keyFields ?? ["id"];

      if (!keyFields) {
        const result = { __typename: typeName } as SourceObject;
        result["id"] = id;
        env.keyMap?.set(result, storeObjectOrKey);
        return result;
      }
      if (typeof keyFields === "string") {
        keyFields = [keyFields];
      }
      const result = Object.fromEntries(
        ["__typename", ...keyFields].map((field) => [
          field,
          value[field as string],
        ]),
      );
      env.keyMap?.set(result, storeObjectOrKey);
      return result;
    }
    visitedKeys.add(storeObjectOrKey);

    keyStack.push(storeObjectOrKey);
    const value = fromNormalizedObject(
      env,
      nodeMap,
      nodeMap[storeObjectOrKey],
      visitedKeys,
      keyStack,
    );
    keyStack.pop();
    env.keyMap?.set(value, storeObjectOrKey);

    return value;
  }
  assert(!storeObjectOrKey["__ref"]);

  const draft = {} as SourceObject;
  for (const [cacheFieldKey, fieldValue] of Object.entries(storeObjectOrKey)) {
    const fieldAST = parseCacheKey(cacheFieldKey);
    const dataKey = fieldAST.alias?.value ?? fieldAST.name.value;

    if (fieldValue === null || typeof fieldValue !== "object") {
      draft[dataKey] = fieldValue as SourceScalar;
      continue;
    }
    if (Array.isArray(fieldValue)) {
      if (!isCompositeListValueTmp(fieldValue)) {
        draft[dataKey] = fieldValue as SourceLeafList;
        continue;
      }
      draft[dataKey] = fromNormalizedList(
        env,
        nodeMap,
        fieldValue,
        visitedKeys,
        keyStack,
      );
      continue;
    }
    assert(typeof fieldValue === "object");
    draft[dataKey] = fromNormalizedObject(
      env,
      nodeMap,
      (fieldValue as Reference)["__ref"] ?? fieldValue,
      visitedKeys,
      keyStack,
    );
  }
  return draft;
}

function isCompositeListValueTmp(value: unknown[]): boolean {
  return value.some((item) =>
    Array.isArray(item)
      ? isCompositeListValueTmp(item)
      : typeof item === "object" && item !== null,
  );
}

function fromNormalizedList(
  env: CacheEnv,
  nodeMap: any,
  normalizedItems: StoreValue[],
  visitedRefs: Set<string>,
  keyStack: string[],
): SourceCompositeList {
  const draftList = [] as SourceCompositeList;
  for (let i = 0; i < normalizedItems.length; i++) {
    const item = normalizedItems[i];
    if (item === null) {
      draftList[i] = null as SourceNull;
      continue;
    }
    if (Array.isArray(item)) {
      draftList[i] = fromNormalizedList(
        env,
        nodeMap,
        item,
        visitedRefs,
        keyStack,
      );
      continue;
    }
    assert(typeof item === "object");
    draftList[i] = fromNormalizedObject(
      env,
      nodeMap,
      (item as Reference)["__ref"] ?? item,
      visitedRefs,
      keyStack,
    );
  }
  return draftList;
}

function accumulateSpreadedFragments(
  fragment: FragmentDefinitionNode,
  fragmentsByName: Map<string, FragmentDefinitionNode>,
  acc: FragmentDefinitionNode[] = [],
) {
  visit(fragment, {
    FragmentSpread(spread) {
      const match = fragmentsByName.get(spread.name.value);
      if (match) {
        acc.push(match);
        accumulateSpreadedFragments(match, fragmentsByName, acc);
      }
    },
  });
  return acc;
}
