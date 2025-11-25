import { useState, useEffect, useCallback, useMemo } from "react";
import type { HistoryChangeSerialized } from "@graphitation/apollo-forest-run";

export interface UseHistorySelectionOptions {
  history: HistoryChangeSerialized[];
  initialIndex?: number | null;
}

/**
 * Hook to manage history entry selection
 */
export function useHistorySelection({ history }: UseHistorySelectionOptions) {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(
    history.length - 1,
  );

  // Auto-select the last entry when history changes
  useEffect(() => {
    setSelectedIndex(history.length - 1);
  }, [history]);

  const selectedEntry = useMemo(() => {
    if (selectedIndex === null || !history[selectedIndex]) {
      return null;
    }
    return history[selectedIndex];
  }, [selectedIndex, history]);

  const selectEntry = useCallback((index: number) => {
    setSelectedIndex(index);
  }, []);

  const hasNext = selectedIndex !== null && selectedIndex < history.length - 1;
  const hasPrevious = selectedIndex !== null && selectedIndex > 0;

  return {
    selectedIndex,
    selectedEntry,
    selectEntry,
    hasNext,
    hasPrevious,
  };
}
