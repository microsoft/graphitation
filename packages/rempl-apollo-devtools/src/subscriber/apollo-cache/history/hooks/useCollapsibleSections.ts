import { useState, useCallback } from "react";

export interface UseCollapsibleSectionsResult {
  isExpanded: (sectionId: string) => boolean;
  toggle: (sectionId: string) => void;
}

export interface UseCollapsibleSectionsOptions {
  initialExpanded?: string[];
}

/**
 * Hook to manage collapsible sections state
 */
export function useCollapsibleSections({
  initialExpanded = [],
}: UseCollapsibleSectionsOptions = {}): UseCollapsibleSectionsResult {
  const [expandedSections, setExpandedSections] = useState(
    new Set<string>(initialExpanded),
  );

  const isExpanded = useCallback(
    (sectionId: string) => expandedSections.has(sectionId),
    [expandedSections],
  );

  const toggle = useCallback((sectionId: string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(sectionId)) {
        next.delete(sectionId);
      } else {
        next.add(sectionId);
      }
      return next;
    });
  }, []);

  return {
    isExpanded,
    toggle,
  };
}
