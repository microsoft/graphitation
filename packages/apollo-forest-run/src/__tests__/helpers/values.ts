import { IndexedObject, indexObject } from "../../forest/indexTree";
import {
  OperationDescriptor,
  PossibleSelections,
} from "../../descriptor/types";
import { ObjectDraft, SourceObject } from "../../values/types";
import { createDraft } from "../../values/draft";

import { createTestOperation, parseOnce } from "./descriptor";
import { generateMockObject, removeMockDirectives } from "./mock";

const defaultConfig = {
  objectKey: (obj: any) => obj.id,
};

export function generateChunk(query: string): IndexedObject {
  const document = parseOnce(query);
  const source = generateMockObject(document);
  removeMockDirectives(document);
  const op = createTestOperation(document);

  return createTestChunk(op, source);
}

export function createTestChunk(
  op: string | OperationDescriptor,
  source: object,
  possibleSelections?: PossibleSelections,
  config = defaultConfig,
): IndexedObject {
  if (typeof op === "string") {
    op = createTestOperation(op);
  }
  if (!possibleSelections) {
    possibleSelections = op.possibleSelections;
  }
  return indexObject(config, op, source as SourceObject, possibleSelections);
}

export function createTestDraft(
  op: string | OperationDescriptor,
  source?: object,
): ObjectDraft {
  if (typeof op === "string") {
    op = createTestOperation(op);
  }
  const draft = createDraft(
    op,
    op.possibleSelections,
    op.rootNodeKey,
    op.rootType,
  );
  draft.data = source as any;
  return draft;
}
