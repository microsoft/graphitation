import {
  CompositeListChunk,
  ObjectChunk,
  ValueKind,
} from "../../../values/types";
import {
  UpdateLogger,
  createUpdateLogger,
  makeCopyStats,
} from "../updateLogger";

describe("UpdateLogger", () => {
  let logger: UpdateLogger;
  const queryName = "TestQuery";
  const testObjectChunk = {
    type: "MY_TYPE",
    kind: ValueKind.Object,
    selection: {
      depth: 3,
      fieldQueue: ["field1", "field2"],
    },
  } as unknown as ObjectChunk;

  const testArrayChunk = {
    type: "MY_TYPE",
    kind: ValueKind.CompositeList,
    itemChunks: ["item1", "item2"],
  } as unknown as CompositeListChunk;

  beforeEach(() => {
    logger = createUpdateLogger(true) as UpdateLogger;
  });

  it("should initialize with empty stats", () => {
    expect(logger.getStats(queryName)).toEqual({
      objectsCopied: 0,
      objectFieldsCopied: 0,
      arraysCopied: 0,
      arrayItemsCopied: 0,
      operationName: "TestQuery",
      updates: [],
    });
  });

  it("should not log updates when disabled", () => {
    const disabledLogger = createUpdateLogger(false);
    disabledLogger?.startChunkUpdate(testObjectChunk);
    disabledLogger?.fieldMutation();
    disabledLogger?.finishChunkUpdate();

    expect(disabledLogger?.getStats(queryName)).toEqual(undefined);
  });

  it("should finish chunk", () => {
    logger.startChunkUpdate(testObjectChunk);
    logger.finishChunkUpdate();

    const chunkUpdateStats = logger.getStats(queryName);
    expect(chunkUpdateStats.updates.length).toEqual(1);
    expect(chunkUpdateStats.updates[0]).toEqual({
      nodeType: "MY_TYPE",
      depth: 3,
      updateStats: {
        fieldsMutated: 0,
        itemsMutated: 0,
        ...makeCopyStats(),
      },
      updateAscendantStats: makeCopyStats(),
    });
  });

  it("should track field mutations", () => {
    logger.startChunkUpdate(testObjectChunk);
    logger.fieldMutation();
    logger.fieldMutation();
    logger.finishChunkUpdate();

    const chunkUpdateStats = logger.getStats(queryName);
    expect(chunkUpdateStats.updates[0].updateStats.fieldsMutated).toEqual(2);
  });

  it("should track item mutations", () => {
    logger.startChunkUpdate(testObjectChunk);
    logger.itemMutation();
    logger.itemMutation();
    logger.finishChunkUpdate();

    const chunkUpdateStats = logger.getStats(queryName);
    expect(chunkUpdateStats.updates[0].updateStats.itemsMutated).toEqual(2);
  });

  it("should record object copy stats", () => {
    logger.startChunkUpdate(testObjectChunk);
    logger.copyChunkStats(testArrayChunk, undefined);
    logger.finishChunkUpdate();

    const chunkUpdateStats = logger.getStats(queryName);
    expect(chunkUpdateStats.updates[0].updateStats.arraysCopied).toEqual(1);
    expect(chunkUpdateStats.updates[0].updateStats.arrayItemsCopied).toEqual(2);
  });
});
