import { ForestRun } from "./ForestRun";
import { extract } from "./cache/extract";
import { restore } from "./cache/restore";
import { resolveOperationDescriptor } from "./cache/descriptor";
import { indexTree } from "./forest/indexTree";
import { replaceTree } from "./forest/addTree";
import type { StoreObject } from "@apollo/client";
import { getEffectiveReadLayers } from "./cache/store";

/**
 * Separate class for better compatibility with Apollo InMemoryCache
 * (supports extract/restore in the format expected by InMemoryCache)
 */
export class ForestRunCompat extends ForestRun {
  public frExtract() {
    return {
      forest: this.store.dataForest.trees,
      optimisticForest: this.store.optimisticLayers,
    };
  }

  public extract(optimistic = false): StoreObject {
    const activeTransaction = peek(this.transactionStack);
    const effectiveOptimistic =
      activeTransaction?.forceOptimistic ?? optimistic;

    return extract(
      this.env,
      getEffectiveReadLayers(
        this.store,
        this.getActiveForest(),
        effectiveOptimistic,
      ),
    );
  }

  public restore(nodeMap: Record<string, any>): this {
    const writes = restore(this.env, nodeMap);

    this.reset();
    for (const write of writes) {
      const operation = resolveOperationDescriptor(
        this.env,
        this.store,
        write.query,
        write.variables,
        write.dataId,
      );
      const operationResult = { data: write.result ?? {} };
      const tree = indexTree(this.env, operation, operationResult);
      replaceTree(this.store.dataForest, tree);
    }
    return this;
  }
}

function peek<T>(stack: T[]): T | undefined {
  return stack[stack.length - 1];
}
