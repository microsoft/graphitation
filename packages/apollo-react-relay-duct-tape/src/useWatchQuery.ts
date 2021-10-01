import { useQuery as useApolloQuery, DocumentNode } from "@apollo/client";

export function useWatchQuery(
  documents: {
    watchQueryDocument: DocumentNode;
  },
  fragmentReference: { id: unknown }
) {
  return useApolloQuery(documents.watchQueryDocument, {
    variables: { id: fragmentReference.id },
    fetchPolicy: "cache-only",
  });
}
