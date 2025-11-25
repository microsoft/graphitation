import type { HistoryChangeSerialized } from "@graphitation/apollo-forest-run";

export interface OperationHistoryResponse {
  history: HistoryChangeSerialized[];
  operation: {
    name: string;
    variables?: Record<string, any>;
  };
  totalCount: number;
}
