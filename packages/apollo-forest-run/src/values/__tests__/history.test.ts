import type { ForestEnv } from "../../forest/types";
import type { SourceObject } from "../types";

import { createRegularHistoryEntry, serializeHistory } from "../history";
import {
  completeObjectDoc,
  objectWithMissingFields,
  completeObject,
} from "../../__tests__/helpers/completeObject";
import { createTestOperation } from "../../__tests__/helpers/descriptor";
import {
  createTestTree,
  createTestForest,
  addForestTree,
} from "../../__tests__/helpers/forest";
import { diffTree } from "../../diff/diffTree";
import { updateTree } from "../../forest/updateTree";

describe("history serialization", () => {
  const env: ForestEnv = {
    objectKey: (o: SourceObject) => `${o.__typename}:${o.id}`,
  };

  function buildTree(data: SourceObject) {
    const op = createTestOperation(completeObjectDoc);
    return createTestTree(op, data);
  }

  function update(baseData: SourceObject, nextData: SourceObject) {
    const baseTree = buildTree(baseData);
    const nextTree = buildTree(nextData);
    const forest = createTestForest();
    addForestTree(forest, baseTree);
    const difference = diffTree(forest, nextTree, env);
    return {
      baseTree,
      nextTree,
      result: updateTree(env, baseTree, difference.nodeDifference),
    };
  }

  it("filters empty missingFields sets once all previously missing fields are filled", () => {
    const base = objectWithMissingFields();
    const full = completeObject();

    const { result } = update(base, full);
    const filledMissingFields = new Map();
    // All fields are filled, so the missingFields map should have an entry with an empty set
    filledMissingFields.set(base, new Set());

    const entry = createRegularHistoryEntry(
      buildTree(base),
      result,
      buildTree(full),
      env,
    );
    const serialized = serializeHistory([entry]);

    if (entry.kind === "Regular" && serialized[0].kind === "Regular") {
      expect(entry.missingFields.size).toEqual(1);
      expect(entry.missingFields).toEqual(filledMissingFields);

      // If missing fields have empty sets, they should be filtered out during serialization
      expect(serialized[0].missingFields.length).toBe(0);
    } else {
      throw new Error("Expected Regular history entry");
    }
  });
});
