import { useState, useEffect, useCallback } from "react";
import type { HistoryChangeSerialized as HistoryEntry } from "@graphitation/apollo-forest-run";
import type { OperationHistoryResponse } from "../../../types";

export interface UseHistoryDataResult {
  history: HistoryEntry[];
  operationData: OperationHistoryResponse["operation"] | null;
  totalCount: number;
  loading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

export interface UseHistoryDataOptions {
  operationKey: string | undefined;
  getOperationHistory:
    | ((key: string) => Promise<OperationHistoryResponse | null>)
    | undefined;
}

/**
 * Hook to fetch and manage history data for an operation
 */
export function useHistoryData({
  operationKey,
  getOperationHistory,
}: UseHistoryDataOptions): UseHistoryDataResult {
  const [data, setData] = useState<OperationHistoryResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchHistory = useCallback(async () => {
    if (!operationKey || !getOperationHistory) {
      setData(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await getOperationHistory(operationKey);
      setData(response);
    } catch (e) {
      const errorMessage =
        e instanceof Error ? e : new Error("Failed to fetch history");
      setError(errorMessage);
      console.error("Failed to fetch history:", e);
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [operationKey, getOperationHistory]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  return {
    history: data?.history || [],
    operationData: data?.operation || null,
    totalCount: data?.totalCount || 0,
    loading,
    error,
    refetch: fetchHistory,
  };
}
