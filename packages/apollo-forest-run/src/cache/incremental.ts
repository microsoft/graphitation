import type { Cache } from "@apollo/client";
import {
  DocumentNode,
  SelectionNode,
  SelectionSetNode,
  valueFromASTUntyped,
  visit,
} from "graphql";
import type { CacheEnv, Store } from "./types";
import type { IndexedTree, IncrementalTarget } from "../forest/types";
import type { IncrementalWriteContext } from "./write";
import { resolveOperationDescriptor } from "./descriptor";
import { collectConcreteTypes } from "../descriptor/possibleSelection";
import { isObjectValue } from "../values/predicates";
import type { SourceObject } from "../values/types";
import { assert } from "../jsutils/assert";
import {
  captureIncrementalTarget,
  getIncrementalState,
  isIncrementalTargetValid,
} from "./incrementalState";

export interface IncrementalWriteOptions {
  query: DocumentNode;
  variables?: Record<string, unknown>;
}

export interface IncrementalPayload {
  path: readonly (string | number)[];
  label?: string;
  data?: Record<string, unknown> | null;
}

export interface IncrementalResult {
  data?: Record<string, unknown> | null;
  incremental?: readonly IncrementalPayload[];
  hasNext?: boolean;
}

export interface IncrementalWriteSession {
  write(result: IncrementalResult, overwrite: boolean): void;
  finish(): void;
}

type Path = IncrementalPayload["path"];
type DeferredSelection = {
  path: Path;
  label?: string;
  selection: SelectionSetNode;
  id: string;
  typename: string;
};
type SavedSelection = DeferredSelection & { target: IncrementalTarget };

export function createIncrementalWriter(
  env: CacheEnv,
  store: Store,
  options: IncrementalWriteOptions,
  commit: (
    options: Cache.WriteOptions,
    context: IncrementalWriteContext,
  ) => void,
): IncrementalWriteSession {
  visit(options.query, {
    Directive(node) {
      assert(
        node.name.value !== "stream",
        "ForestRun incremental writes do not support @stream",
      );
    },
    Field(node) {
      assert(
        !node.directives?.some((directive) => directive.name.value === "defer"),
        "ForestRun supports @defer on fragments, not fields",
      );
    },
  });
  const operation = resolveOperationDescriptor(
    env,
    store,
    options.query,
    options.variables,
  );
  assert(
    operation.definition.operation === "query",
    "ForestRun incremental writes require a query",
  );
  const forest = store.dataForest;
  const state = getIncrementalState(forest);
  const variables = operation.variablesWithDefaults;
  const targets = new Map<string, SavedSelection>();
  const discarded: Path[] = [];
  let pending: IncrementalPayload[] = [];
  let initialized = false;
  let finished = false;

  const current = () =>
    store.dataForest === forest && forest.incremental === state;
  const keyOf = (path: Path, label?: string) =>
    JSON.stringify([path, label ?? null]);
  const argument = (node: SelectionNode, directive: string, name: string) => {
    const value = node.directives
      ?.find((item) => item.name.value === directive)
      ?.arguments?.find((item) => item.name.value === name)?.value;
    return value ? valueFromASTUntyped(value, variables) : undefined;
  };
  const included = (node: SelectionNode) =>
    argument(node, "skip", "if") !== true &&
    argument(node, "include", "if") !== false;
  const fragmentOf = (node: Exclude<SelectionNode, { kind: "Field" }>) => {
    const fragment =
      node.kind === "InlineFragment"
        ? node
        : operation.fragmentMap.get(node.name.value);
    assert(
      fragment,
      "ForestRun incremental write references an unknown fragment",
    );
    return fragment;
  };
  const matches = (
    condition: string | undefined,
    typename: string | undefined,
  ) =>
    !condition ||
    (!!typename &&
      (condition === typename ||
        collectConcreteTypes(env.possibleTypes ?? {}, condition).includes(
          typename,
        )));

  function collect(
    tree: IndexedTree,
    selection: SelectionSetNode,
    prefix: Path,
  ) {
    const planned = new Map<string, DeferredSelection>();
    function walk(
      value: unknown,
      fields: SelectionSetNode,
      path: Path,
      visited = new Set<SelectionSetNode>(),
    ) {
      if (Array.isArray(value)) {
        value.forEach((item, index) => walk(item, fields, [...path, index]));
        return;
      }
      if (!value || typeof value !== "object" || visited.has(fields)) return;
      visited.add(fields);
      const object = value as SourceObject;
      const chunk = tree.dataMap.get(object)?.value;
      assert(
        chunk && isObjectValue(chunk),
        "Missing indexed incremental object",
      );
      const typename =
        chunk.type ||
        (path.length === prefix.length ? tree.operation.rootType : undefined);
      for (const node of fields.selections) {
        if (!included(node)) continue;
        if (node.kind === "Field") {
          if (node.selectionSet) {
            const name = node.alias?.value ?? node.name.value;
            walk(object[name], node.selectionSet, [...path, name]);
          }
          continue;
        }
        const fragment = fragmentOf(node);
        if (!matches(fragment.typeCondition?.name.value, typename)) continue;
        const deferred = node.directives?.some(
          (item) => item.name.value === "defer",
        );
        if (deferred && argument(node, "defer", "if") !== false) {
          assert(
            chunk.key && typename,
            `ForestRun @defer requires an identifiable parent at ${JSON.stringify(
              path,
            )}`,
          );
          const label = argument(node, "defer", "label");
          assert(
            label === undefined || typeof label === "string",
            "ForestRun @defer labels must be strings",
          );
          const key = keyOf(path, label);
          const previous = planned.get(key) ?? targets.get(key);
          assert(
            !previous ||
              (previous.id === chunk.key &&
                previous.selection === fragment.selectionSet),
            "Ambiguous ForestRun @defer path/label; use distinct labels",
          );
          planned.set(key, {
            path,
            label,
            selection: fragment.selectionSet,
            id: chunk.key,
            typename,
          });
        } else {
          walk(value, fragment.selectionSet, path, visited);
        }
      }
    }
    walk(tree.result.data, selection, prefix);
    return planned;
  }

  function publish(
    data: Record<string, unknown>,
    selection: SelectionSetNode,
    path: Path,
    overwrite: boolean,
    target?: IncrementalTarget,
  ) {
    let planned: ReturnType<typeof collect> | undefined;
    const query = target
      ? {
          ...operation.document,
          definitions: operation.document.definitions.map((definition) =>
            definition === operation.definition
              ? { ...definition, selectionSet: selection }
              : definition,
          ),
        }
      : operation.document;
    commit(
      {
        query,
        result: data,
        variables,
        dataId: target?.id ?? operation.rootNodeKey,
        overwrite,
      },
      {
        target,
        beforeWrite(tree) {
          planned = collect(tree, selection, path);
        },
      },
    );
    for (const [key, plan] of planned ?? []) {
      targets.set(key, {
        ...plan,
        target: captureIncrementalTarget(forest, plan),
      });
    }
  }

  function payloadType(
    data: Record<string, unknown>,
    selection: SelectionSetNode,
    typename: string,
    visited = new Set<SelectionSetNode>(),
  ): unknown {
    if (data.__typename !== undefined) return data.__typename;
    if (visited.has(selection)) return;
    visited.add(selection);
    for (const node of selection.selections) {
      if (!included(node)) continue;
      if (node.kind === "Field") {
        if (node.name.value === "__typename") {
          const type = data[node.alias?.value ?? node.name.value];
          if (type !== undefined) return type;
        }
      } else {
        const fragment = fragmentOf(node);
        if (matches(fragment.typeCondition?.name.value, typename)) {
          const type = payloadType(
            data,
            fragment.selectionSet,
            typename,
            visited,
          );
          if (type !== undefined) return type;
        }
      }
    }
  }

  function drain() {
    let progress = true;
    while (progress && pending.length) {
      progress = false;
      const unresolved: IncrementalPayload[] = [];
      for (const payload of pending) {
        const key = keyOf(payload.path, payload.label);
        const saved = targets.get(key);
        if (!saved) {
          if (
            !discarded.some((path) =>
              path.every((part, index) => payload.path[index] === part),
            )
          ) {
            unresolved.push(payload);
          }
          continue;
        }
        progress = true;
        targets.delete(key);
        const type =
          payload.data &&
          payloadType(payload.data, saved.selection, saved.typename);
        if (
          !isIncrementalTargetValid(forest, saved.target) ||
          (type != null && type !== saved.typename)
        ) {
          discarded.push(payload.path);
          continue;
        }
        if (payload.data)
          publish(
            payload.data,
            saved.selection,
            payload.path,
            false,
            saved.target,
          );
      }
      pending = unresolved;
    }
  }

  function release() {
    finished = true;
    targets.clear();
    pending = [];
    discarded.length = 0;
  }

  function finish() {
    if (finished) return;
    const unresolved = current() && pending.length > 0;
    release();
    assert(!unresolved, "Unresolved ForestRun @defer path/label at completion");
  }

  return {
    write(result, overwrite) {
      if (!current()) {
        release();
        return;
      }
      assert(!finished, "ForestRun incremental execution has already finished");
      try {
        if (result.data) {
          assert(
            !initialized,
            "Duplicate initial ForestRun incremental result",
          );
          publish(
            result.data,
            operation.definition.selectionSet,
            [],
            overwrite,
          );
          initialized = true;
        }
        if (result.incremental) {
          assert(
            initialized,
            "ForestRun incremental patch arrived before initial data",
          );
          for (const payload of result.incremental) {
            assert(
              Array.isArray(payload.path) &&
                payload.path.every(
                  (part) =>
                    typeof part === "string" ||
                    (Number.isInteger(part) && part >= 0),
                ) &&
                !("items" in payload),
              "ForestRun supports path-based @defer payloads, not @stream",
            );
            assert(
              payload.label === undefined || typeof payload.label === "string",
              "ForestRun @defer labels must be strings",
            );
            assert(
              payload.data == null ||
                (typeof payload.data === "object" &&
                  !Array.isArray(payload.data)),
              "Invalid ForestRun @defer data",
            );
            pending.push(payload);
          }
          drain();
        }
        if (result.hasNext === false) finish();
      } catch (error) {
        release();
        throw error;
      }
    },
    finish,
  };
}
