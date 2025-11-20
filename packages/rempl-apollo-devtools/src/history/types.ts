/**
 * Type definitions for Apollo Forest Run cache history in DevTools
 *
 * This file re-exports Forest-Run types directly with minimal additions
 * for DevTools-specific serialization needs.
 */

import type {
  HistoryEntry as ForestRunHistoryEntry,
  RegularHistoryEntry as ForestRunRegularHistoryEntry,
  OptimisticHistoryEntry as ForestRunOptimisticHistoryEntry,
  HistoryChange as ForestRunHistoryChange,
  FieldChange as ForestRunFieldChange,
  CompositeListLayoutChange as ForestRunCompositeListLayoutChange,
} from "@graphitation/apollo-forest-run";

import {
  DifferenceKind,
  ItemChangeKind,
} from "@graphitation/apollo-forest-run";

// Re-export Forest-Run types for use throughout DevTools
export type {
  ForestRunHistoryEntry,
  ForestRunRegularHistoryEntry,
  ForestRunOptimisticHistoryEntry,
  ForestRunHistoryChange,
  ForestRunFieldChange,
  ForestRunCompositeListLayoutChange,
};

// Re-export kind constants
export { DifferenceKind, ItemChangeKind };

// DevTools uses HistoryChange (which has path) not FieldChange (which has fieldInfo)
export type FieldChange = ForestRunHistoryChange;
export type ListItemChange = ForestRunCompositeListLayoutChange;

/**
 * Base structure shared by all history entries
 */
export interface HistoryEntryBase {
  /** Timestamp when this change occurred */
  timestamp: number;

  /** Information about the operation that caused this change */
  modifyingOperation: {
    name: string;
    variables: Record<string, unknown>;
  };

  /** Data snapshots (only available with enableRichHistory) */
  data?: {
    /** Cache state before this change */
    current: unknown;
    /** Incoming data from the operation */
    incoming?: unknown;
    /** Cache state after this change (only for regular entries) */
    updated?: unknown;
  };

  /** Missing fields that couldn't be resolved */
  missingFields?: MissingFieldInfo[];
}

/**
 * A regular (non-optimistic) cache update with detailed field-level changes
 */
export interface RegularHistoryEntry extends HistoryEntryBase {
  kind: "Regular";

  /** List of individual field changes with paths */
  changes: FieldChange[];
}

/**
 * An optimistic cache update with node-level diffs
 */
export interface OptimisticHistoryEntry extends HistoryEntryBase {
  kind: "Optimistic";

  /** Map of node keys to their differences */
  nodeDiffs: NodeDiff[];

  /** List of node keys that were updated */
  updatedNodes: string[];
}

/**
 * Union type for all history entry types
 */
export type HistoryEntry = RegularHistoryEntry | OptimisticHistoryEntry;

/**
 * Represents differences in a cache node during optimistic updates
 * DevTools-specific type for serialized node diffs
 */
export interface NodeDiff {
  /** The cache key for this node */
  nodeKey: string;

  /** Difference kind (numeric enum from forest-run) */
  kind: number;

  /** Whether the node is complete */
  complete?: boolean;

  /** Fields that changed */
  dirtyFields?: string[];

  /** Detailed field state changes */
  fieldState?: FieldState[];
}

/**
 * Represents the state change for a specific field
 * DevTools-specific type for serialized field state
 */
export interface FieldState {
  /** Field name */
  fieldKey: string;

  /** State kind (numeric enum) */
  kind: number;

  /** Previous value */
  oldValue?: unknown;

  /** New value */
  newValue?: unknown;

  /** Field entry metadata */
  fieldEntry?: unknown;
}

/**
 * Information about fields that are missing from the cache
 * DevTools-specific type for serialized missing field info
 */
export interface MissingFieldInfo {
  /** Identifier for the object with missing fields */
  objectIdentifier: string;

  /** List of missing fields */
  fields: Array<{
    name: string;
    dataKey: string;
  }>;
}
/**
 * Represents differences in a cache node during optimistic updates
 * DevTools-specific type for serialized node diffs
 */
export interface NodeDiff {
  /** The cache key for this node */
  nodeKey: string;

  /** Difference kind (numeric enum from forest-run) */
  kind: number;

  /** Whether the node is complete */
  complete?: boolean;

  /** Fields that changed */
  dirtyFields?: string[];

  /** Detailed field state changes */
  fieldState?: FieldState[];
}

/**
 * Represents the state change for a specific field
 * DevTools-specific type for serialized field state
 */
export interface FieldState {
  /** Field name */
  fieldKey: string;

  /** State kind (numeric enum) */
  kind: number;

  /** Previous value */
  oldValue?: unknown;

  /** New value */
  newValue?: unknown;

  /** Field entry metadata */
  fieldEntry?: unknown;
}

/**
 * Information about fields that are missing from the cache
 * DevTools-specific type for serialized missing field info
 */
export interface MissingFieldInfo {
  /** Identifier for the object with missing fields */
  objectIdentifier: string;

  /** List of missing fields */
  fields: Array<{
    name: string;
    dataKey: string;
  }>;
}

/**
 * Represents differences in a cache node during optimistic updates
 */
export interface NodeDiff {
  /** The cache key for this node */
  nodeKey: string;

  /** Difference kind (numeric enum from forest-run) */
  kind: number;

  /** Whether the node is complete */
  complete?: boolean;

  /** Fields that changed */
  dirtyFields?: string[];

  /** Detailed field state changes */
  fieldState?: FieldState[];
}

/**
 * Represents the state change for a specific field
 */
export interface FieldState {
  /** Field name */
  fieldKey: string;

  /** State kind (numeric enum) */
  kind: number;

  /** Previous value */
  oldValue?: unknown;

  /** New value */
  newValue?: unknown;

  /** Field entry metadata */
  fieldEntry?: unknown;
}

/**
 * Information about fields that are missing from the cache
 */
export interface MissingFieldInfo {
  /** Identifier for the object with missing fields */
  objectIdentifier: string;

  /** List of missing fields */
  fields: Array<{
    name: string;
    dataKey: string;
  }>;
}

/**
 * Represents differences in a cache node during optimistic updates
 */
export interface NodeDiff {
  /** The cache key for this node */
  nodeKey: string;

  /** Difference kind (numeric enum from forest-run) */
  kind: number;

  /** Whether the node is complete */
  complete?: boolean;

  /** Fields that changed */
  dirtyFields?: string[];

  /** Detailed field state changes */
  fieldState?: FieldState[];
}

/**
 * Represents the state change for a specific field
 */
export interface FieldState {
  /** Field name */
  fieldKey: string;

  /** State kind (numeric enum) */
  kind: number;

  /** Previous value */
  oldValue?: unknown;

  /** New value */
  newValue?: unknown;

  /** Field entry metadata */
  fieldEntry?: unknown;
}

/**
 * Information about fields that are missing from the cache
 */
export interface MissingFieldInfo {
  /** Identifier for the object with missing fields */
  objectIdentifier: string;

  /** List of missing fields */
  fields: Array<{
    name: string;
    dataKey: string;
  }>;
}
