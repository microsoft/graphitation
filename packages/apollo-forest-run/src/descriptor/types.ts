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
};

export type DocumentDescriptor = {
  document: DocumentNode;
  fragmentMap: FragmentMap;
  debugName: string;
  definition: OperationDefinitionNode;
};

export type ResultTreeDescriptor = {
  possibleSelections: PossibleSelections;
  fieldsWithArgs: FieldInfo[]; // aggregated from all levels
};

// Selection with additional information based on operation variables (resolved at runtime)
export type ResolvedSelection = PossibleSelection & {
  normalizedFields?: Map<FieldInfo, NormalizedFieldEntry>;
  skippedFields?: Set<FieldInfo>;
  skippedSpreads?: Set<SpreadInfo>;
};

export type OperationDescriptor = {
  id: OperationId;
  env: OperationEnv;
  document: DocumentNode;
  fragmentMap: FragmentMap;
  debugName: string;
  definition: OperationDefinitionNode;
  possibleSelections: PossibleSelections;
  variables: VariableValues;
  variablesWithDefaults: VariableValues;
  variablesKey: string; // Stringified, normalized variables
  keyVariables: VariableName[] | null;
  rootType: TypeName; // e.g. Query | Mutation, etc
  rootNodeKey: NodeKey; // e.g. ROOT_QUERY | ROOT_MUTATION, etc
  selections: Map<PossibleSelections, Map<TypeName | null, ResolvedSelection>>;
  cache: boolean;
  historySize: number | null; // Size of operation history to keep from @cache(history: N) directive
};

export type FormattedError = GraphQLFormattedError;

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

  experimentalAlias?: FragmentAlias;
  experimentalAliasedFragments?: Map<FragmentAlias, PossibleSelection>;
};

export type ResolvedSelections = Map<
  PossibleSelections,
  Map<TypeName | null, ResolvedSelection>
>;

export type PossibleTypes = { [abstractType: TypeName]: TypeName[] };

// e.g. { a: foo { bar }, { b: foo { baz } } -> same canonical name `foo` leads to multiple entries: `a { bar }` and `b { baz }`;
export type FieldMap = Map<FieldName, FieldInfo[]>;
export type FragmentSpreadMap = Map<FragmentName, SpreadInfo[]>;
