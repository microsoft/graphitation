/**
 * Type definitions for Apollo Forest Run cache history in DevTools
 *
 * This file re-exports Forest-Run types directly with minimal additions
 * for DevTools-specific serialization needs.
 */

import type {
  HistoryChangeSerialized,
  SerializedNodeDifference,
  HistoryFieldChange,
} from "@graphitation/apollo-forest-run";

import {
  DifferenceKind,
  ItemChangeKind,
} from "@graphitation/apollo-forest-run";

// Re-export kind constants
export { DifferenceKind, ItemChangeKind };

export type HistoryEntry = HistoryChangeSerialized;
export type NodeDiff = SerializedNodeDifference;
export type FieldChange = HistoryFieldChange;

