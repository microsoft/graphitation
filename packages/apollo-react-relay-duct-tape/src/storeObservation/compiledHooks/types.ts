export interface FragmentReference {
  /**
   * In case of a watch query on a Node type, the `id` needs to be provided.
   * In case of a watch query on the Query type, this should be omitted.
   */
  id?: unknown;

  /**
   * These are the request variables, which is named awkwardly `__fragments`
   * because that's the name of the property Relay uses to pass context data so
   * not introducing a different property name felt right, from a migration
   * perspective.
   */
  __fragments?: Record<string, any>;
}
