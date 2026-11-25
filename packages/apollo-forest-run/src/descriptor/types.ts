import {
  DocumentNode,
  FieldNode,
  FragmentDefinitionNode,
  FragmentSpreadNode,
  GraphQLFormattedError,
  OperationDefinitionNode,
  SelectionNode,
  ValueNode,
} from "graphql";
import { HistoryConfig } from "../cache/types";

export type TypeName = string;
export type FieldName = string;
export type FieldAlias = string;
export type DataKey = string;
export type FragmentName = string;
export type FragmentAlias = string;
export type VariableName = string;
export type DeferLabel = string;
export type VariableValues = { [name: VariableName]: unknown };
export type NodeKey = string;
export type OperationId = number;
export type ArgumentValues = Map<string, unknown>;
export type Directives = Map<string, { args: ArgumentValues }>;
export type KeySpecifier = readonly string[];
export type Key = string;

// In Apollo fragment spread with @nonreactive indicates watch boundary (for `watchFragment`).
// Operations can always be observed with `watchQuery`
export type OperationWatchBoundary = "";
export type WatchBoundary = FragmentName | OperationWatchBoundary;

export type NormalizedFieldEntry =
  | string
  | {
      readonly name: FieldName;
      readonly args: ArgumentValues;
      readonly keyArgs?: Key | KeySpecifier;
    };

export type FragmentMap = Map<string, FragmentDefinitionNode>;

export type OperationEnv = {
  genId?: () => OperationId;

  // ApolloCompat:
  //   Have to keep it as a function for now, should convert to simple static list from type policies
  objectKey?: (
    obj: object,
    selection?: PossibleSelection,
    operation?: OperationDescriptor,
  ) => Key | false | undefined;

  keyArgs?: (
    typeName: string,
    fieldName: string,
    args?: ArgumentValues,
    directives?: Directives,
    source?: OperationDescriptor | undefined,
  ) => Key | KeySpecifier | undefined;

  historyConfig?: HistoryConfig;

  // Feature flag: build descriptors from an explicit literal (stable object shape). Enabled unless `false`.
  optimizeDescriptorShape?: boolean;
};

export type DocumentDescriptor = {
  document: DocumentNode;
  fragmentMap: FragmentMap;
  debugName: string;
  definition: OperationDefinitionNode;
  hasDefaultValues: boolean;
};

export type ResultTreeDescriptor = {
  possibleSelections: PossibleSelections;
  fieldsWithArgs: FieldInfo[]; // aggregated from all levels
  hasDeferSites: boolean;
};

// Selection with additional information based on operation variables (resolved at runtime)
export type ResolvedSelection = PossibleSelection & {
  normalizedFields?: Map<FieldInfo, NormalizedFieldEntry>;
  skippedFields?: Set<FieldInfo>;
  skippedSpreads?: Set<SpreadInfo>;
  deferredFragments?: DeferSite[]; // enabled for the operation variables
  resolvedHash?: number; // Structural hash + runtime-resolved state (args, skip/include)
};

/**
 * Kinds of documents with their own result trees:
 *
 * - `Operation`: regular operation (query, mutation, subscription)
 * - `DetachedFragment`: Apollo fragment document (`query { ...Fragment }` + fragment definitions)
 *   used with `writeFragment` / `readFragment` / `watchFragment`. Its root is usually a regular node
 *   (identified by `dataId` / `id`), not an operation root.
 * - `OperationFragment`: sub-selection of an operation (e.g. data of a deferred fragment).
 *   Points to the actual operation descriptor and is never stored on its own (see OperationFragmentDescriptor).
 */
export type DescriptorKind =
  | "Operation"
  | "DetachedFragment"
  | "OperationFragment";

type DescriptorBase = {
  id: OperationId;
  name: string | undefined;
  env: OperationEnv;
  document: DocumentNode;
  fragmentMap: FragmentMap;
  debugName: string;
  definition: OperationDefinitionNode;
  hasDefaultValues: boolean;
  possibleSelections: PossibleSelections;
  hasDeferSites: boolean;
  variables: VariableValues;
  variablesWithDefaults: VariableValues;
  variablesKey: string; // Stringified, normalized variables
  keyVariables: VariableName[] | null;
  rootType: TypeName; // e.g. Query | Mutation, etc
  rootNodeKey: NodeKey; // e.g. ROOT_QUERY | ROOT_MUTATION, etc
  selections: Map<PossibleSelections, Map<TypeName | null, ResolvedSelection>>;
  cache: boolean;
  historySize: number; // Size of operation history to keep
  covers: string[]; // Operation names this operation covers (from @cache(covers: [...]))
};

export type RegularOperationDescriptor = {
  readonly kind: "Operation";
} & DescriptorBase;

export type DetachedFragmentDescriptor = {
  readonly kind: "DetachedFragment";
} & DescriptorBase;

// Descriptor of any document which may own a stored result tree
export type OperationDescriptor =
  | RegularOperationDescriptor
  | DetachedFragmentDescriptor;

/**
 * Sub-selection of an operation, e.g. a deferred fragment (a selection of objects within the operation result).
 *
 * Its trees are indexed in the context of the actual `operation` (all chunks reference it), starting from
 * the selection of the root object within this operation. Never stored in the forest.
 *
 * A descriptor is not tied to a specific object: it may be shared by trees of all objects with this selection
 * (e.g. all list items with a deferred fragment). Per-object data (e.g. root node key) belongs to trees.
 */
export type OperationFragmentDescriptor = {
  readonly kind: "OperationFragment";
  operation: OperationDescriptor;
  possibleSelections: PossibleSelections; // Selection of the root object within the operation
};

// Descriptor of any result tree, including transient trees which are never stored
export type TreeDescriptor = OperationDescriptor | OperationFragmentDescriptor;

export type FormattedError = GraphQLFormattedError;

export type ResponsePath = ReadonlyArray<string | number>;

export type FieldInfo = {
  name: FieldName;
  dataKey: FieldAlias | FieldName;
  args?: Map<string, ValueNode>; // keeping as ValueNode to simplify matching against variables later
  alias?: FieldAlias;
  selection?: PossibleSelections;
  watchBoundaries: WatchBoundary[];

  // AST references MUST NOT be used outside indexing. There is no guarantee they will exist.
  // E.g. consider case when "Selection" structures are generated at build time.
  __refs: ASTFieldReference[];
};

export type SpreadInfo = {
  name: FragmentName;
  watchBoundaries: WatchBoundary[];
  alias?: FragmentAlias;
  __refs: ASTSpreadReference[];
};

export type ASTFieldReference = {
  node: FieldNode;
  ancestors: SelectionNode[];
};

export type ASTSpreadReference = {
  node: FragmentSpreadNode;
  ancestors: SelectionNode[];
};

export type ASTReference = ASTFieldReference | ASTSpreadReference;

export type PossibleSelections = Map<TypeName | null, PossibleSelection>;
export type PossibleSelection = {
  depth: number;
  fields: FieldMap;
  fieldsWithSelections?: FieldName[];
  fieldQueue: FieldInfo[];
  fieldsToNormalize?: FieldInfo[];
  fieldsWithDirectives?: FieldInfo[]; // fields affected by include/skip/defer directives

  spreads?: FragmentSpreadMap; // e.g. object with selection { foo, ...Bar, ... { ...Baz } } will have ["Bar", "Baz"] here
  spreadsWithDirectives?: SpreadInfo[];
  deferSites?: DeferSite[];

  experimentalAlias?: FragmentAlias;
  experimentalAliasedFragments?: Map<FragmentAlias, PossibleSelection>;

  hasDescendantsToResolve?: boolean; // true if any descendant has fieldsToNormalize, fieldsWithDirectives, or spreadsWithDirectives

  structuralHash: number; // Order-independent hash of field structure (names, dataKeys, arg names, child hashes)
};

// A deferred fragment in the document (its data is written with the selection of the object it is deferred on)
//
// TODO: for defer-aware reads (`dataState: "streaming"`), add `deferBoundary` to `FieldInfo`: the closest enclosing
//   `DeferSite` of a field (collected like `watchBoundaries`). A missing field is then pending if its boundary is
//   a site still waiting for data on the object.
export type DeferSite = {
  label?: DeferLabel;
  conditions: { variable: VariableName; expected: boolean; defer: boolean }[];
};

export type ResolvedSelections = Map<
  PossibleSelections,
  Map<TypeName | null, ResolvedSelection>
>;

export type PossibleTypes = { [abstractType: TypeName]: TypeName[] };

// e.g. { a: foo { bar }, { b: foo { baz } } -> same canonical name `foo` leads to multiple entries: `a { bar }` and `b { baz }`;
export type FieldMap = Map<FieldName, FieldInfo[]>;
export type FragmentSpreadMap = Map<FragmentName, SpreadInfo[]>;
