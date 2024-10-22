import { IndexedTree } from "../forest/types";
import { GraphDifference } from "../diff/diffTree";
import { OperationDescriptor } from "../descriptor/types";
import { NodeDifferenceMap } from "../forest/updateTree";
import { ResultTree } from "./types";

export type TransactionStats = {
  kind: "Transaction";
  time: number;
  start: number;
  error: string; // empty string when no error
  writes: WriteStats[];
  reads: ReadStats[];
  steps: {
    updateCallback: OperationStep;
    collectWatches: OperationStep & {
      affectedOperations: number;
      dirtyWatches: number;
    };
    removeOptimistic: OperationStep & {
      dirtyNodes: string[];
    };
    notifyWatches: OperationStep;
  };
  children: TransactionStats[];
};

export type WriteStats = {
  kind: "Write";
  op: string;
  time: number;
  start: number;
  steps: {
    descriptor: OperationStep;
    indexing: OperationStep & {
      totalNodes: number;
    };
    mergePolicies: OperationStep;
    diff: OperationStep & {
      dirtyNodes: [string, Set<string>][];
      newNodes: string[];
      errors: number;
    };
    affectedOperations: OperationStep & {
      totalCount: number;
    };
    update: OperationStep & {
      newTreeAdded: boolean;
      totalUpdated: number;
    };
    affectedLayerOperations: OperationStep & {
      totalCount: number;
    };
    invalidateReadResults: OperationStep;
  };
};

export type ReadStats = {
  kind: "Read";
  op: string;
  error: string; // empty string when no error
  time: number;
  start: number;
  steps: {
    createOutputTree: OperationStep & {
      totalNodes: number;
      incompleteChunks: number;
    };
    updateOutputTree: OperationStep & {
      dirtyNodes: Map<string, unknown>;
      totalNodes: number;
      incompleteChunks: number;
    };
  };
};

export type OperationStep = {
  time: number;
  start: number;
};

const EMPTY_SET = new Set<any>();
EMPTY_SET["add"] = () => {
  throw new Error("Frozen set");
};

type Transaction = {
  affectedOperations: Set<OperationDescriptor> | null;
};

export class TransactionStatsCollector {
  private stats: TransactionStats = this.create();
  private active = false;

  start() {
    this.stats.start = performance.now();
    this.active = true;
  }

  finish(): TransactionStats {
    if (this.active) {
      this.active = false;
      this.stats.time = performance.now() - this.stats.start;
    }
    return this.stats;
  }

  addChild(transaction: TransactionStats) {
    if (!this.active) return;
    this.stats.children.push(transaction);
  }

  addWrite(write: WriteStats) {
    if (!this.active) return;
    this.stats.writes.push(write);
  }

  addRead(read: ReadStats) {
    if (!this.active) return;
    this.stats.reads.push(read);
  }

  registerError(error: Error) {
    if (!this.active) return;
    this.stats.error = error.message;
  }

  startUpdateCallback() {
    if (!this.active) return;
    this.stats.steps.updateCallback.start = performance.now();
  }

  finishUpdateCallback() {
    if (!this.active) return;
    this.stats.steps.updateCallback.time =
      performance.now() - this.stats.steps.updateCallback.start;
  }

  startCollectingWatches() {
    if (!this.active) return;
    this.stats.steps.collectWatches.start = performance.now();
  }

  finishCollectingWatches(
    activeTransaction: Transaction,
    watchesToNotify: Set<unknown> | null,
  ) {
    if (!this.active) return;
    this.stats.steps.collectWatches.affectedOperations =
      activeTransaction.affectedOperations?.size ?? 0;
    this.stats.steps.collectWatches.dirtyWatches = watchesToNotify?.size ?? 0;
    this.stats.steps.collectWatches.time =
      performance.now() - this.stats.steps.collectWatches.start;
  }

  startRemoveOptimistic() {
    if (!this.active) return;
    this.stats.steps.removeOptimistic.start = performance.now();
  }

  finishRemoveOptimistic(affectedNodes: string[]) {
    if (!this.active) return;
    this.stats.steps.removeOptimistic.time =
      performance.now() - this.stats.steps.removeOptimistic.start;
    this.stats.steps.removeOptimistic.dirtyNodes = affectedNodes;
  }

  startNotifyWatches() {
    if (!this.active) return;
    this.stats.steps.notifyWatches.start = performance.now();
  }

  finishNotifyWatches() {
    if (!this.active) return;
    this.stats.steps.notifyWatches.time =
      performance.now() - this.stats.steps.notifyWatches.start;
  }

  private create(): TransactionStats {
    return {
      kind: "Transaction",
      time: Number.NaN,
      error: "",
      writes: [],
      reads: [],
      children: [],
      steps: {
        updateCallback: {
          time: Number.NaN,
          start: Number.NaN,
        },
        collectWatches: {
          time: Number.NaN,
          start: Number.NaN,
          dirtyWatches: -1,
          affectedOperations: -1,
        },
        removeOptimistic: {
          time: Number.NaN,
          start: Number.NaN,
          dirtyNodes: [],
        },
        notifyWatches: {
          time: Number.NaN,
          start: Number.NaN,
        },
      },
      start: Number.NaN,
    };
  }
}

export class WriteStatsCollector {
  private stats: WriteStats = this.create();
  private active = false;

  start() {
    this.stats = this.create();
    this.stats.start = performance.now();
    this.active = true;
  }

  finish(): WriteStats {
    if (this.active) {
      this.active = false;
      this.stats.time = performance.now() - this.stats.start;
    }
    return this.stats;
  }

  startDescriptor() {
    if (!this.active) return;
    this.stats.steps.descriptor.start = performance.now();
  }

  finishDescriptor(op: OperationDescriptor) {
    if (!this.active) return;
    this.stats.op = op.debugName;
    this.stats.steps.descriptor.time =
      performance.now() - this.stats.steps.descriptor.start;
  }

  startIndexing() {
    if (!this.active) return;
    this.stats.steps.indexing.start = performance.now();
  }

  finishIndexing(tree: IndexedTree) {
    if (!this.active) return;
    this.stats.steps.indexing.totalNodes = tree.nodes.size;
    this.stats.steps.indexing.time =
      performance.now() - this.stats.steps.indexing.start;
  }

  startMergePolicies() {
    if (!this.active) return;
    this.stats.steps.mergePolicies.start = performance.now();
  }

  finishMergePolicies(_: IndexedTree) {
    if (!this.active) return;
    this.stats.steps.mergePolicies.time =
      performance.now() - this.stats.steps.mergePolicies.start;
  }

  startDiff() {
    if (!this.active) return;
    this.stats.steps.diff.start = performance.now();
  }

  finishDiff(diff: GraphDifference) {
    if (!this.active) return;
    const step = this.stats.steps.diff;
    step.newNodes = diff.newNodes;
    for (const [nodeKey, difference] of diff.nodeDifference) {
      step.dirtyNodes.push([nodeKey, difference.dirtyFields ?? EMPTY_SET]);
    }
    step.time = performance.now() - step.start;
    step.errors = diff.errors.length;
  }

  startResolvingAffectedOperations() {
    if (!this.active) return;
    this.stats.steps.affectedOperations.start = performance.now();
  }

  finishResolvingAffectedOperations(
    ops: Map<OperationDescriptor, NodeDifferenceMap>,
  ) {
    if (!this.active) return;
    const step = this.stats.steps.affectedOperations;
    step.time = performance.now() - step.start;
    step.totalCount = ops.size;
  }

  startUpdating() {
    if (!this.active) return;
    this.stats.steps.update.start = performance.now();
  }

  finishUpdating(totalUpdated: number, newTreeAdded: boolean) {
    if (!this.active) return;
    const step = this.stats.steps.update;
    step.totalUpdated = totalUpdated;
    step.newTreeAdded = newTreeAdded;
    step.time = performance.now() - step.start;
  }

  startResolvingOtherLayersImpact() {
    if (!this.active) return;
    this.stats.steps.affectedLayerOperations.start = performance.now();
  }

  finishResolvingOtherLayersImpact(
    ops: Map<OperationDescriptor, NodeDifferenceMap>,
  ) {
    if (!this.active) return;
    const step = this.stats.steps.affectedLayerOperations;
    step.totalCount = ops.size - step.totalCount;
    step.time = performance.now() - step.start;
  }

  startInvalidateReadResults() {
    if (!this.active) return;
    this.stats.steps.invalidateReadResults.start = performance.now();
  }

  finishInvalidateReadResults() {
    if (!this.active) return;
    this.stats.steps.invalidateReadResults.time =
      performance.now() - this.stats.steps.invalidateReadResults.start;
  }

  private create(): WriteStats {
    return {
      kind: "Write",
      time: Number.NaN,
      op: "",
      steps: {
        descriptor: {
          time: Number.NaN,
          start: Number.NaN,
        },
        indexing: {
          time: Number.NaN,
          totalNodes: -1,
          start: Number.NaN,
        },
        mergePolicies: {
          time: Number.NaN,
          start: Number.NaN,
        },
        diff: {
          time: Number.NaN,
          dirtyNodes: [],
          newNodes: [],
          errors: -1,
          start: Number.NaN,
        },
        affectedOperations: {
          time: Number.NaN,
          start: Number.NaN,
          totalCount: -1,
        },
        update: {
          time: Number.NaN,
          totalUpdated: -1,
          newTreeAdded: false,
          start: Number.NaN,
        },
        affectedLayerOperations: {
          time: Number.NaN,
          start: Number.NaN,
          totalCount: -1,
        },
        invalidateReadResults: {
          time: Number.NaN,
          start: Number.NaN,
        },
      },
      start: Number.NaN,
    };
  }
}

export class ReadStatsCollector {
  private stats: ReadStats = this.create();
  private active = false;

  start() {
    this.stats = this.create();
    this.stats.start = performance.now();
    this.active = true;
  }

  finish(): ReadStats {
    if (this.active) {
      this.active = false;
      this.stats.time = performance.now() - this.stats.start;
    }
    return this.stats;
  }

  startGrowOutputTree() {
    if (!this.active) return;
    this.stats.steps.createOutputTree.start = performance.now();
  }

  finishGrowOutputTree(tree: ResultTree) {
    if (!this.active) return;
    const step = this.stats.steps.createOutputTree;
    step.incompleteChunks = tree.incompleteChunks.size;
    step.totalNodes = tree.nodes.size;
    step.time = performance.now() - step.start;
    this.stats.op = tree.operation.debugName;
  }

  startUpdateOutputTree(dirtyNodes: Map<string, unknown>) {
    if (!this.active) return;
    const step = this.stats.steps.updateOutputTree;
    step.start = performance.now();
    for (const [nodeKey, dirtyFields] of dirtyNodes) {
      step.dirtyNodes.set(nodeKey, dirtyFields ?? EMPTY_SET);
    }
    this.stats.steps.updateOutputTree.dirtyNodes = dirtyNodes;
  }

  finishUpdateOutputTree(tree: ResultTree) {
    if (!this.active) return;
    const step = this.stats.steps.updateOutputTree;
    step.incompleteChunks = tree.incompleteChunks.size;
    step.totalNodes = tree.nodes.size;
    step.time = performance.now() - step.start;
    this.stats.op = tree.operation.debugName;
  }

  private create(): ReadStats {
    return {
      kind: "Read",
      time: Number.NaN,
      error: "",
      op: "",
      steps: {
        createOutputTree: {
          time: Number.NaN,
          start: Number.NaN,
          incompleteChunks: -1,
          totalNodes: -1,
        },
        updateOutputTree: {
          time: Number.NaN,
          start: Number.NaN,
          dirtyNodes: new Map(),
          incompleteChunks: -1,
          totalNodes: -1,
        },
      },
      start: Number.NaN,
    };
  }
}
