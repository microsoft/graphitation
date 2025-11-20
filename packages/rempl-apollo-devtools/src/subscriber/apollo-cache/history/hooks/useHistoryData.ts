import { useState, useEffect, useCallback } from "react";
import type { HistoryEntry } from "../../../../history/types";

export interface UseHistoryDataResult {
  history: HistoryEntry[];
  operationData: {
    name: string;
    variables?: Record<string, unknown>;
  } | null;
  totalCount: number;
  loading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

export interface UseHistoryDataOptions {
  operationKey: string | undefined;
  getOperationHistory: ((key: string) => Promise<unknown>) | undefined;
  autoFetch?: boolean;
}

/**
 * Hook to fetch and manage history data for an operation
 */
export function useHistoryData({
  operationKey,
  getOperationHistory,
  autoFetch = true,
}: UseHistoryDataOptions): UseHistoryDataResult {
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [operationData, setOperationData] = useState<{
    name: string;
    variables?: Record<string, unknown>;
  } | null>(null);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchHistory = useCallback(async () => {
    if (!operationKey || !getOperationHistory) {
      setHistory([]);
      setOperationData(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response: any = await getOperationHistory(operationKey);

      if (response) {
        // Handle new response format with operation data
        if (
          !Array.isArray(response) &&
          response.history &&
          Array.isArray(response.history)
        ) {
          setHistory(response.history as HistoryEntry[]);
          setOperationData(response.operation || null);
          setTotalCount(response.totalCount || response.history.length);
        }
        // Handle legacy format (just array of history)
        else if (Array.isArray(response)) {
          setHistory(response as HistoryEntry[]);
          setOperationData(null);
          setTotalCount(response.length);
        } else {
          setHistory([]);
          setOperationData(null);
          setTotalCount(0);
        }
      } else {
        setHistory([]);
        setOperationData(null);
        setTotalCount(0);
      }
    } catch (e) {
      const errorMessage =
        e instanceof Error ? e : new Error("Failed to fetch history");
      setError(errorMessage);
      console.error("Failed to fetch history:", e);
      setHistory([]);
      setOperationData(null);
    } finally {
      setLoading(false);
    }
  }, [operationKey, getOperationHistory]);

  useEffect(() => {
    if (autoFetch) {
      fetchHistory();
    }
  }, [autoFetch, fetchHistory]);

  return {
    history,
    operationData,
    totalCount,
    loading,
    error,
    refetch: fetchHistory,
  };
}
