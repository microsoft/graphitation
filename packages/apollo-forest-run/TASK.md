# Task: Fix O(n) ROOT_QUERY chunk iteration in cold reads

## Problem

When reading an operation that doesn't have a cached result (`no-cache` miss), `growOutputTree` calls `hydrateDraft` which iterates **all** ROOT_QUERY chunks from **all** operations in the forest. With N operations, each cold read costs O(N). A burst of M cold reads compounds: each read adds a tree, so total cost = SUM(N..N+M) = O(N*M + M^2).

**Real-world impact**: In Teams, a roster panel open does ~50 cold reads (`query user` per participant). After 25 roster open/close cycles (~1000 accumulated operations), a single roster open degrades from ~400ms to ~1000ms+.

## Root cause

### The hot path

```
readOperation (read.ts)
  → growOutputTree
    → growDataTree
      → hydrateDraft(rootDraft, chunkProvider([forest]), chunkMatcher([forest]))
```

In `hydrateDraft` (draft.ts), the `enterObject` callback returns all chunks for a node:

```typescript
enterObject(model, selection, firstVisit, output) {
  // chunkMatcher bails immediately for ROOT_QUERY (too many unchecked ops)
  const match = chunkMatcher(model.key, draft.operation, selection);
  // match is undefined → fall through

  // Returns ALL ROOT_QUERY chunks from ALL operations
  return chunkProvider(model.key); // → getNodeChunks(layers, "ROOT_QUERY")
}
```

Then `executeObjectSelection` (execute.ts:189) iterates them:

```typescript
for (const chunk of chunks) {                    // iterates ALL ROOT_QUERY chunks
  incompleteFields = executeObjectChunkSelection(
    context, selection, chunk, source, typeName, incompleteFields,
  );
  if (!incompleteFields.length) break;           // only breaks when ALL fields resolved
}
```

For `query user { user(userId: "x") { id name } }`:
- ROOT_QUERY has 1 field: `user`
- Chunk from `BgQuery0 { node0 { id } }` doesn't have `user` → `resolveField` returns `undefined` → field stays incomplete
- Loop continues to next chunk... and the next... scanning all 500+ chunks
- Eventually finds the chunk that has `user` (from the operation that wrote user data)
- Total: ~500 chunks scanned to find 1 field

### Why `findRecyclableChunk` doesn't help

`findRecyclableChunk` (draftHelpers.ts) checks how many operations have a given node:

```typescript
const totalTreesWithNode = opsWithNode?.size ?? 0;
// ...
if (totalTreesWithNode - checkedInLayer > 0) {
  return void 0; // bails out — can't guarantee all chunks are checked
}
```

For ROOT_QUERY with 500 operations and only 1-2 checked, this ALWAYS returns `undefined`. So recycling never works for ROOT_QUERY in a large cache.

### The compounding effect

Each cold read creates a NEW tree via `growDataTree` → `addTree(forest, dataTree)`. So within a burst of 50 reads:
- Read 1: iterates N chunks for ROOT_QUERY
- Read 2: iterates N+1 chunks
- Read 50: iterates N+49 chunks
- Total iterations: ~50 * (N + 25)

With N=500 background ops: 50 * 525 = 26,250 chunk iterations per burst.
With N=1000: 50 * 1025 = 51,250 (2x worse).

## Evidence from instrumented traces (Teams roster perf gate, 5 iterations)

Each iteration opens the roster panel (50 users) then closes it. Same Apollo cache across all iterations.

| Run | Trees | ROOT_QUERY chunks/read (avg) | `query user` avg time | Total scenario time |
|-----|-------|------------------------------|----------------------|---------------------|
| 2   | 430→501 | 722 | 1.35ms | 869ms |
| 5   | 910→960 | 1354 | 1.53ms (max 8.1ms) | 1935ms |

Non-ROOT_QUERY nodes (e.g., `User:*`) stay constant at max pc=9 — they're not the bottleneck.

## Benchmark

Branch `vladar/forest-run-read-scaling-benchmark` adds scenario `read-cold-burst-from-large-cache` to `packages/apollo-forest-run-benchmark`. It populates a cache with 500 operations, then does 50 cold reads (fresh `DocumentNode` each → cache miss → full `growOutputTree`).

```
bgOps=10   burst avg=7.4ms
bgOps=250  burst avg=13.0ms
bgOps=500  burst avg=20.0ms
bgOps=1000 burst avg=34.5ms
```

## Key source files

All paths relative to `packages/apollo-forest-run/src/`:

| File | Key functions | Role |
|------|--------------|------|
| `cache/read.ts` | `readOperation`, `growOutputTree`, `growDataTree` | Entry point; creates draft, hydrates, indexes |
| `values/draft.ts` | `hydrateDraft` | Hydrates draft from chunks; calls chunkProvider/chunkMatcher |
| `values/execute.ts` | `executeObjectSelection`, `executeObjectChunkSelection` | Iterates chunks to resolve fields (the hot loop at line 189) |
| `cache/draftHelpers.ts` | `getNodeChunks`, `findRecyclableChunk`, `createChunkProvider`, `createChunkMatcher` | Chunk iteration and recycling logic |
| `forest/types.ts` | `IndexedForest` type | Available indexes: `operationsByNodes`, `operationsByName`, etc. |
| `cache/store.ts` | `createStore` | Index initialization |
| `forest/addTree.ts` | `addTree`, `trackTreeNodes` | How trees are added and indexed |

## Possible fixes

### 1. Field-level index for ROOT_QUERY chunks

Add an index: `rootFieldIndex: Map<FieldName, Set<OperationId>>` mapping each ROOT_QUERY field name to the operations that provide it. Populated in `addTree` when indexing ROOT_QUERY nodes, cleaned up in `removeDataTree`.

In `getNodeChunks` (or a new variant), when `key === "ROOT_QUERY"` and the caller knows which fields it needs, yield only chunks from operations that have those fields. This turns the scan from O(all_operations) to O(operations_with_field).

**Pros**: Precise, minimal overhead. **Cons**: Requires threading field info through `chunkProvider` → `getNodeChunks`, changing the `ChunkProvider` signature.

### 2. Prioritize own-operation chunks in `getNodeChunks`

Modify `getNodeChunks` to yield the current operation's chunks FIRST (before iterating other operations). For cold reads where the data was already written by the same operation name, the needed field would be found in the first chunk.

```typescript
function* getNodeChunks(layers, key, includeDeleted, priorityOpId?) {
  // Yield priority operation's chunks first
  if (priorityOpId) {
    for (const layer of layers) {
      const tree = layer.trees.get(priorityOpId);
      if (tree) yield* tree.nodes.get(key) ?? [];
    }
  }
  // Then yield remaining
  for (const layer of layers) {
    const operations = layer.operationsByNodes.get(key);
    for (const opId of operations ?? []) {
      if (opId === priorityOpId) continue;
      // ... existing logic
    }
  }
}
```

**Pros**: Simple change, helps when own-operation has the data. **Cons**: Doesn't help when the data comes from a DIFFERENT operation (e.g., `query user` reading from `usersForConversation` write). Still O(N) in worst case.

### 3. Early termination in `executeObjectSelection` for single-field root queries

If the root selection has only 1 field and the first chunk resolves it, break immediately. This is already handled by `if (!incompleteFields.length) break;` — but only AFTER iterating to a chunk that has the field. The issue is reaching that chunk.

Could be combined with approach #2: if the operation's own chunk has the field, it's found first and breaks.

### 4. Smarter `findRecyclableChunk` for ROOT_QUERY

Currently bails when `totalTreesWithNode - checkedInLayer > 0`. Could be relaxed: if the operation's own tree has a complete chunk for ROOT_QUERY, recycle it regardless of how many other trees exist. The current check is conservative — it assumes unchecked trees might have conflicting data.

**Pros**: Could enable recycling for ROOT_QUERY. **Cons**: May produce incorrect results if different operations have different ROOT_QUERY shapes. Needs careful correctness analysis.

### 5. Cache eviction / max operations

Enable `maxOperationCount` config or add LRU eviction to limit forest size. Prevents unbounded growth of `operationsByNodes.get("ROOT_QUERY")`.

**Pros**: Addresses the root cause (unbounded growth). **Cons**: App-level configuration, doesn't fix the O(N) algorithm itself. May evict still-needed operations.

### 6. Fix operation descriptor reuse (app-level)

The deeper question is: why are operation descriptors not reused across roster open/close cycles? Each `query user` creates a new descriptor per roster open. If descriptors were reused (same `DocumentNode` instance), `resultsMap.get(operationDescriptor)` would return cached results and skip `growOutputTree` entirely.

**Pros**: Eliminates cold reads entirely. **Cons**: Requires app-side fix (React component lifecycle, Apollo hook behavior). Not a ForestRun fix.

## Recommended approach

Fix #1 (field-level ROOT_QUERY index) is the most targeted and correct solution. It directly addresses the O(N) scan with O(1) lookup, works regardless of which operation provides the data, and doesn't require app-side changes. Can be combined with #5 (eviction) as a defense-in-depth measure.

## Constraints

- All 1081 existing tests must pass (`yarn test:own` in package root)
- No test modifications
- Lint must pass (`yarn lint`)
- Benchmark `read-cold-burst-from-large-cache` should show improvement
c