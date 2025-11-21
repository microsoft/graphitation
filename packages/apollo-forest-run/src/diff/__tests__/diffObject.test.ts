import { cloneDeep } from "lodash";
import { diffObject } from "../diffObject";
import { PossibleSelections, VariableValues } from "../../descriptor/types";
import { assert } from "../../jsutils/assert";
import { ObjectChunk } from "../../values/types";
import { SourceObject } from "../../values/types";
import {
  ObjectDiffState,
  MissingModelFieldsError,
  DiffErrorKind,
  DiffEnv,
} from "../types";
import {
  completeObject,
  completeObjectDoc,
  entityFoo,
  entityFooConnection,
  entityFooEdge,
  objectWithMissingFields,
  plainObjectFoo,
} from "../../__tests__/helpers/completeObject";
import { createPatches } from "../../__tests__/helpers/createPatches";
import { createObjectAggregate } from "../../values/create";
import { indexObject } from "../../forest/indexTree";
import { isComplete, isDirty, isCompositeListDifference } from "../difference";
import { gql, createTestOperation } from "../../__tests__/helpers/descriptor";
import { createParentLocator, TraverseEnv } from "../../values";

const scalarValueChanges = (): Array<[unknown, unknown]> => [
  [``, null],
  [null, ``],
  [null, false],
  [false, null],
  [true, false],
  [false, true],
  [``, `0`],
  [``, `false`],
  [``, `new`],
  [`0`, ``],
  [`false`, ``],
  [`old`, ``],
  [`old`, `new`],
  [-1, 0],
  [Number.MIN_VALUE, 0],
  // Custom scalars:
  [null, { customScalar: "value" }],
  [{ customScalar: "value" }, null],
  [{ customScalar: "value1" }, { customScalar: "value2" }],
  [null, new Date(1722531605526)],
  [new Date(1722531605526), null],
  [new Date(1722531605520), new Date(1722531605529)],
];

it("produces empty diff when there are no changes", () => {
  const base = completeObject();
  const model = completeObject();
  const result = diffChunkCombinations(base, model);

  expect(result).toEqual({ patches: [], stale: [] });
});

describe("diff scalars", () => {
  describe("replaces old value with new one", () => {
    test.each(scalarValueChanges())(`#%#: %p → %p`, (oldValue, newValue) => {
      const base = completeObject({ scalar: oldValue });
      const model = completeObject({ scalar: newValue });
      const result = diffChunkCombinations(base, model);

      expect(result).toMatchObject({
        patches: [{ op: "replace", path: ["scalar"], value: newValue }],
        stale: [],
      });
      expect(result.stale).toEqual([]);
    });
  });

  describe("empty diff when no changes", () => {
    test.each(scalarValueChanges().map((a) => a[0]))(`#%#: %p`, (value) => {
      const base = completeObject({ scalar: value });
      const model = completeObject({ scalar: value });
      const result = diffChunkCombinations(base, model);

      expect(result).toMatchObject({
        patches: [],
        stale: [],
      });
    });
  });
});

describe("diff list of scalars", () => {
  describe("replaces old value with new one", () => {
    test.each([
      [null, []],
      [null, [[]]],
      [null, [null, [], null]],
      [null, [null, [null], null]],
      [null, [null, "foo", null, "bar", null]],
      [null, [[null], ["foo"], [null, "bar", null]]],
      [[], null],
      [[], [null]],
      [[], [[]]],
      [[], [null, [], null]],
      [[], [null, [null], null]],
      [[], [null, "foo", null, "bar", null]],
      [[], [[null, "foo", null, "bar", null]]],
      [null, []],
      [[null], []],
      [[[]], []],
      [[null, [], null], []],
      [[null, [null], null], []],
      [[null, "foo", null, "bar", null], []],
      [[[null, "foo", null, "bar", null]], []],
      [
        [[], "foo"],
        [null, "foo"],
      ],
      [
        [null, "foo"],
        [[], "foo"],
      ],
      [
        [null, "foo"],
        [null, "foo", null, "bar", null],
      ],
      [
        [null, "foo", null, "bar", null],
        [null, "foo"],
      ],
      [
        [null, "foo", null, "bar", null],
        [null, "bar", null, "baz", null],
      ],
      [
        [[], []],
        [[], [null]],
      ],
      [
        [[], [null]],
        [[], []],
      ],
      [[[], [null]], null],
    ])(`#%#: %p → %p`, (oldValue, newValue) => {
      const base = completeObject({ scalarList: oldValue });
      const model = completeObject({ scalarList: newValue });
      const result = diffChunkCombinations(base, model);

      expect(result).toMatchObject({
        patches: [{ op: "replace", path: ["scalarList"], value: newValue }],
        stale: [],
      });
    });
  });

  describe("empty diff when no changes", () => {
    test.each([
      [[]],
      [[[]]],
      [[null]],
      [[false]],
      [[0]],
      [[1]],
      [[true]],
      [[[null]]],
      [[null, "foo", null, "bar"]],
    ])("`#%#: %p`", (value) => {
      const base = completeObject({ scalarList: value });
      const model = completeObject({ scalarList: cloneDeep(value) });
      const result = diffChunkCombinations(base, model);

      expect(result).toMatchObject({ patches: [], stale: [] });
    });
  });
});

describe("diff nodes", () => {
  describe("replaces old value with new one", () => {
    test.each([
      [null, "a"],
      ["a", null],
      ["a", "b"],
    ])(`#%#: %p → %p`, (oldValue, newValue) => {
      const base = completeObject({ entity: keyToEntity(oldValue) });
      const model = completeObject({ entity: keyToEntity(newValue) });
      const result = diffChunkCombinations(base, model);

      expect(result).toMatchObject({
        patches: [
          { op: "replace", path: ["entity"], value: keyToEntity(newValue) },
        ],
        stale: [],
      });
    });
  });

  describe("empty diff when no changes", () => {
    test.each([
      ["a", "a"],
      // `diffEntity` is scoped to key-check (normally consisted of __typename and id).
      // Changes of nested fields are ignored (should be differed via separate diffNode calls)
      [entityFoo({ foo: "foo" }), entityFoo({ foo: "changed" })],
    ])(`#%#: %p → %p`, (oldValue, newValue) => {
      const base = completeObject({ entity: keyToEntity(oldValue) });
      const model = completeObject({ entity: keyToEntity(newValue) });
      const result = diffChunkCombinations(base, model);

      expect(result).toMatchObject({
        patches: [],
        stale: [],
      });
    });
  });
});

describe("diff plain objects", () => {
  describe("replaces old value with new one", () => {
    test.each([
      [null, plainObjectFoo()],
      [plainObjectFoo(), null],
    ])(`#%#: %p → %p`, (oldValue, newValue) => {
      const base = completeObject({ plainObject: oldValue });
      const model = completeObject({ plainObject: newValue });
      const result = diffChunkCombinations(base, model);

      expect(result).toMatchObject({
        patches: [{ op: "replace", path: ["plainObject"], value: newValue }],
        stale: [],
      });
    });
  });

  describe("empty diff when no changes", () => {
    test.each([
      [plainObjectFoo(), plainObjectFoo()],
      [plainObjectFoo({ foo: null }), plainObjectFoo({ foo: null })],
    ])("`#%#: %p`", (oldValue, newValue) => {
      const base = completeObject({ plainObject: oldValue });
      const model = completeObject({ plainObject: newValue });
      const result = diffChunkCombinations(base, model);

      expect(result).toMatchObject({ patches: [], stale: [] });
    });
  });

  describe("field change: scalar", () => {
    describe("replaces old value with new one", () => {
      it.each(scalarValueChanges())(`#%#: %p → %p`, (oldValue, newValue) => {
        const base = completeObject({
          completeObject: completeObject({ scalar: oldValue }),
        });
        const model = completeObject({
          completeObject: completeObject({ scalar: newValue }),
        });
        const result = diffChunkCombinations(base, model);

        expect(result).toMatchObject({
          patches: [
            {
              op: "replace",
              path: ["completeObject", "scalar"],
              value: newValue,
            },
          ],
          stale: [],
        });
      });
    });

    describe("empty diff when no changes", () => {
      test.each(scalarValueChanges().map((a) => a[0]))(`#%#: %p`, (value) => {
        const base = completeObject({
          completeObject: completeObject({ scalar: value }),
        });
        const model = completeObject({
          completeObject: completeObject({ scalar: value }),
        });
        const result = diffChunkCombinations(base, model);

        expect(result).toMatchObject({
          patches: [],
          stale: [],
        });
      });
    });
  });

  describe("field change: scalarList", () => {
    describe("replaces old value with new one", () => {
      test.each([
        [null, []],
        [null, [null]],
        [null, [null, "foo"]],
        [[], [null]],
        [[null], []],
        [
          [null, "bar"],
          [null, "bar", null, "baz", null],
        ],
        [
          [null, "bar", null, "baz", null],
          [null, "bar"],
        ],
        [[null], [0]],
        [[0], [null]],
        [[0], [1]],
        [
          [null, "foo", null, "bar", null],
          [null, "bar", null, "baz", null],
        ],
      ])("#%#: %p → %p", (baseList, modelList) => {
        const base = completeObject({
          completeObject: completeObject({ scalarList: baseList }),
        });
        const model = completeObject({
          completeObject: completeObject({ scalarList: modelList }),
        });

        const result = diffChunkCombinations(base, model);

        expect(result).toMatchObject({
          patches: [
            {
              op: "replace",
              path: ["completeObject", "scalarList"],
              value: modelList,
            },
          ],
          stale: [],
        });
      });
    });

    describe("empty diff when no changes", () => {
      it.each([
        [[]],
        [[null]],
        [[0]],
        [["foo"]],
        [[null, "foo", null, "bar", null]],
      ])("#%#: %p", (baseList) => {
        const modelList = [...baseList];

        const base = completeObject({
          completeObject: completeObject({ scalarList: baseList }),
        });
        const model = completeObject({
          completeObject: completeObject({ scalarList: modelList }),
        });
        const result = diffChunkCombinations(base, model);

        expect(result).toMatchObject({ patches: [], stale: [] });
      });
    });
  });

  describe("field change: entity", () => {
    describe("replaces old value with new one", () => {
      test.each([
        [null, "a"],
        ["a", null],
        ["a", "b"],
      ])(`#%#: %p → %p`, (oldValue, newValue) => {
        const base = completeObject({
          completeObject: completeObject({ entity: keyToEntity(oldValue) }),
        });
        const model = completeObject({
          completeObject: completeObject({ entity: keyToEntity(newValue) }),
        });
        const result = diffChunkCombinations(base, model);

        expect(result).toMatchObject({
          patches: [
            {
              op: "replace",
              path: ["completeObject", "entity"],
              value: keyToEntity(newValue),
            },
          ],
          stale: [],
        });
      });
    });

    describe("empty diff when no changes", () => {
      it.each([
        ["a", "a"],
        // `diffEntity` is scoped to key-check (normally consisted of __typename and id).
        // Changes of nested fields are ignored (should be differed via separate diffNode calls)
        [entityFoo({ foo: "foo" }), entityFoo({ foo: "changed" })],
      ])(`#%#: %p → %p`, (oldValue, newValue) => {
        const base = completeObject({
          completeObject: completeObject({ entity: keyToEntity(oldValue) }),
        });
        const model = completeObject({
          completeObject: completeObject({ entity: keyToEntity(newValue) }),
        });
        const result = diffChunkCombinations(base, model);

        expect(result).toMatchObject({
          patches: [],
          stale: [],
        });
      });
    });
  });

  describe("field change: plainObject", () => {
    describe("replaces old value with new one", () => {
      test.each([
        [null, plainObjectFoo()],
        [plainObjectFoo(), null],
      ])(`#%#: %p → %p`, (oldValue, newValue) => {
        const base = completeObject({
          completeObject: completeObject({ plainObject: oldValue }),
        });
        const model = completeObject({
          completeObject: completeObject({ plainObject: newValue }),
        });
        const result = diffChunkCombinations(base, model);

        expect(result).toMatchObject({
          patches: [
            {
              op: "replace",
              path: ["completeObject", "plainObject"],
              value: newValue,
            },
          ],
          stale: [],
        });
      });
    });

    describe("empty diff when no changes", () => {
      test.each([
        [plainObjectFoo(), plainObjectFoo()],
        [plainObjectFoo({ foo: null }), plainObjectFoo({ foo: null })],
      ])("`#%#: %p`", (oldValue, newValue) => {
        const base = completeObject({
          completeObject: completeObject({ plainObject: oldValue }),
        });
        const model = completeObject({
          completeObject: completeObject({ plainObject: newValue }),
        });
        const result = diffChunkCombinations(base, model);

        expect(result).toMatchObject({ patches: [], stale: [] });
      });
    });
  });

  // TODO: nested lists, nested abstract types
});

describe("diff lists of nodes", () => {
  describe("replaces old value with new one", () => {
    test.each([
      [null, []],
      [[], null],
      [null, ["a", null, "b"]],
      [["a", null, "b"], null],
    ])(`#%#: %p → %p`, (oldValue, newValue) => {
      const oldList = oldValue === null ? null : oldValue.map(keyToEntity);
      const newList = newValue === null ? null : newValue.map(keyToEntity);

      const base = completeObject({ entityList: oldList });
      const model = completeObject({ entityList: newList });
      const result = diffChunkCombinations(base, model);

      expect(result).toMatchObject({
        patches: [{ op: "replace", path: ["entityList"], value: newList }],
        stale: [],
      });
    });
  });

  describe("empty diff when no changes", () => {
    it.each([
      [[]],
      [[null]],
      [[null, null]],
      [[null, "a", null]],
      [["a"]],
      [["a", "b"]],
    ])("#%#: %p", (baseListKeys) => {
      const base = completeObject({
        entityList: baseListKeys.map(keyToEntity),
      });
      const model = completeObject({
        entityList: baseListKeys.map(keyToEntity),
      });
      const result = diffChunkCombinations(base, model);

      expect(result).toMatchObject({
        patches: [],
        stale: [],
      });
    });
  });

  describe("detects removal of nodes from the list", () => {
    it.each([
      [["a"], [], []],
      [
        [null, "a", null],
        ["a", null],
        [1, null],
      ],
      [["a", null], [null], [null]],
      [
        ["a", "b", "c"],
        ["a", "b"],
        [0, 1],
      ],
      [
        ["a", "b", "c"],
        ["b", "c"],
        [1, 2],
      ],
      [
        ["a", "b", "c"],
        ["a", "c"],
        [0, 2],
      ],
    ])("#%#: %p → %p", (oldList, newList, expectedLayout) => {
      const base = completeObject({
        entityList: oldList.map(keyToEntity),
      });
      const model = completeObject({
        entityList: newList.map(keyToEntity),
      });

      const result = diffChunkCombinations(base, model);

      expect(result).toMatchObject({
        patches: [
          {
            op: "alterListLayout",
            path: ["entityList"],
            value: expectedLayout,
          },
        ],
        stale: [],
      });
    });
  });

  describe("detects addition of nodes to the list", () => {
    it.each([
      [[], [null], [null]],
      [[], ["a"], ["a"]],
      [[null], ["a", null], ["a", null]],
      [
        ["a", "b"],
        ["a", "b", "c"],
        [0, 1, "c"],
      ],
      [
        ["b", "c"],
        ["a", "b", "c"],
        ["a", 0, 1],
      ],
      [
        ["a", "c"],
        ["a", "b", "c"],
        [0, "b", 1],
      ],
    ])("#%#: %p → %p", (oldList, newList, expectedLayout) => {
      const base = completeObject({
        entityList: oldList.map(keyToEntity),
      });
      const model = completeObject({
        entityList: newList.map(keyToEntity),
      });

      const result = diffChunkCombinations(base, model);

      expect(result).toMatchObject({
        patches: [
          {
            op: "alterListLayout",
            path: ["entityList"],
            value: expectedLayout.map(keyToEntity),
          },
        ],
        stale: [],
      });
    });
  });

  describe("detects changed node order", () => {
    it.each([
      [
        ["a", null],
        [null, "a"],
        [null, 0],
      ],
      [
        ["a", "b", "c"],
        ["b", "a", "c"],
        [1, 0, 2],
      ],
      [
        ["a", "b", "c"],
        ["a", "c", "b"],
        [0, 2, 1],
      ],
      [
        ["a", "b", "c"],
        ["c", "b", "a"],
        [2, 1, 0],
      ],
      [
        ["a", "b", "c"],
        ["c", "a", "b"],
        [2, 0, 1],
      ],
    ])("#%#: %p → %p", (oldList, newList, expectedLayout) => {
      const base = completeObject({ entityList: oldList.map(keyToEntity) });
      const model = completeObject({ entityList: newList.map(keyToEntity) });

      const result = diffChunkCombinations(base, model);

      expect(result).toMatchObject({
        patches: [
          {
            op: "alterListLayout",
            path: ["entityList"],
            value: expectedLayout.map(keyToEntity),
          },
        ],
        stale: [],
      });
    });
  });

  describe("correctly nullifies nodes in the list", () => {
    it.each([
      [
        ["a", "b", "c"],
        ["a", "b", null],
        [0, 1, null],
      ],
      [
        ["a", "b", "c"],
        ["a", null, "c"],
        [0, null, 2],
      ],
      [
        ["a", "b", "c"],
        [null, "b", "c"],
        [null, 1, 2],
      ],
      [
        ["a", "b", "c"],
        [null, null, "c"],
        [null, null, 2],
      ],
      [
        ["a", "b", "c"],
        [null, null, null],
        [null, null, null],
      ],
    ])("#%#: %p → %p", (oldList, newList, expectedLayout) => {
      const base = completeObject({ entityList: oldList.map(keyToEntity) });
      const model = completeObject({ entityList: newList.map(keyToEntity) });

      const result = diffChunkCombinations(base, model);

      expect(result).toMatchObject({
        patches: [
          {
            op: "alterListLayout",
            path: ["entityList"],
            value: expectedLayout.map(keyToEntity),
          },
        ],
        stale: [],
      });
    });
  });

  describe("correctly replaces nullified nodes in the list", () => {
    it.each([
      [
        ["a", "b", null],
        ["a", "b", "c"],
        [0, 1, "c"],
      ],
      [
        ["a", null, "c"],
        ["a", "b", "c"],
        [0, "b", 2],
      ],
      [
        [null, "b", "c"],
        ["a", "b", "c"],
        ["a", 1, 2],
      ],
      [
        [null, null, "c"],
        ["a", "b", "c"],
        ["a", "b", 2],
      ],
      [
        [null, null, null],
        ["a", "b", "c"],
        ["a", "b", "c"],
      ],
    ])("#%#: %p → %p", (oldList, newList, expectedLayout) => {
      const base = completeObject({ entityList: oldList.map(keyToEntity) });
      const model = completeObject({ entityList: newList.map(keyToEntity) });

      const result = diffChunkCombinations(base, model);

      expect(result).toMatchObject({
        patches: [
          {
            op: "alterListLayout",
            path: ["entityList"],
            value: expectedLayout.map(keyToEntity),
          },
        ],
        stale: [],
      });
    });
  });

  describe("correctly handles duplicates", () => {
    it.each([
      [["a"], ["a", "a"], [0, 0]],
      [["a", "a"], ["a"], [0]],
      [
        [null, "a"],
        ["a", "a"],
        [1, 1],
      ],
      [
        ["a", null],
        ["a", "a"],
        [0, 0],
      ],
      [
        ["a", "a"],
        ["a", null],
        [0, null],
      ],
      [
        ["a", "a"],
        [null, "a"],
        [null, 0],
      ],
      [
        ["a", "b", null, "a"],
        ["a", "a", "a"],
        [0, 0, 0],
      ],
      [
        ["a", "b", "a", "a"],
        ["a", "a"],
        [0, 0],
      ],
    ])("#%#: %p → %p", (oldList, newList, expectedLayout) => {
      const base = completeObject({ entityList: oldList.map(keyToEntity) });
      const model = completeObject({ entityList: newList.map(keyToEntity) });

      const result = diffChunkCombinations(base, model);

      expect(result).toMatchObject({
        patches: [
          {
            op: "alterListLayout",
            path: ["entityList"],
            value: expectedLayout.map(keyToEntity),
          },
        ],
        stale: [],
      });
    });
  });
  describe("records deleted items", () => {
    test.each([
      [["a", "b", "c"], ["b"], [1], [0, 2]],
      [
        ["a", null, "b", "c"],
        ["b", null],
        [2, null],
        [0, 1, 3],
      ],
      [[["a", "b"], "c"], ["c"], [1], [0]],
    ])(
      "#%#: %p → %p",
      (oldListKeys, newListKeys, expectedLayout, expectedDeletedKeys) => {
        const base = completeObject({
          entityList: oldListKeys.map(keyToEntity),
        });
        const model = completeObject({
          entityList: newListKeys.map(keyToEntity),
        });

        const { result } = diff(base, model);
        const difference = result.difference;
        assert(difference);

        const fieldDiff = difference.fieldState.get("entityList");
        expect(fieldDiff).toMatchObject({
          kind: 4,
          fieldEntry: "entityList",
          state: {
            kind: 3,
            layout: expectedLayout,
            deletedKeys: new Set(expectedDeletedKeys),
          },
        });
      },
    );
  });
});

describe("diff lists of plain objects", () => {
  describe("replaces old value with new one", () => {
    test.each([
      [null, []],
      [[], null],
      [null, [plainObjectFoo()]],
      [[plainObjectFoo()], null],
    ])(`#%#: %p → %p`, (oldValue, newValue) => {
      const base = completeObject({ plainObjectList: oldValue });
      const model = completeObject({ plainObjectList: newValue });
      const result = diffChunkCombinations(base, model);

      expect(result).toMatchObject({
        patches: [
          { op: "replace", path: ["plainObjectList"], value: newValue },
        ],
        stale: [],
      });
    });
  });

  describe("empty diff when no changes", () => {
    it.each([
      [[]],
      [[null]],
      [[null, null]],
      [[null, completeObject(), null]],
      [[completeObject()]],
      [[completeObject(), completeObject()]],
    ])("#%#: %p", (baseList) => {
      const base = completeObject({
        completeObjectList: baseList,
      });
      const model = completeObject({
        completeObjectList: cloneDeep(baseList),
      });
      const result = diffChunkCombinations(base, model);

      expect(result).toMatchObject({
        patches: [],
        stale: [],
      });
    });
  });

  describe("item field change: scalar", () => {
    describe("replaces old value with new one", () => {
      test.each(scalarValueChanges())(`#%#: %p → %p`, (oldValue, newValue) => {
        const original = completeObject({ scalar: oldValue });
        const changed = completeObject({ scalar: newValue });

        const base = completeObject({
          completeObjectList: [null, original, null, completeObject()],
        });
        const model = completeObject({
          completeObjectList: [null, changed, null, completeObject()],
        });
        const result = diffChunkCombinations(base, model);

        expect(result).toMatchObject({
          patches: [
            {
              op: "replace",
              path: ["completeObjectList", 1, "scalar"],
              value: newValue,
            },
          ],
          stale: [],
        });
      });
    });

    describe("empty diff when no changes", () => {
      test.each(scalarValueChanges().map((a) => a[0]))(`#%#: %p`, (value) => {
        const base = completeObject({
          completeObject: completeObject({ scalar: value }),
        });
        const model = completeObject({
          completeObject: completeObject({ scalar: value }),
        });
        const result = diffChunkCombinations(base, model);

        expect(result).toMatchObject({
          patches: [],
          stale: [],
        });
      });
    });
  });

  describe("item field change: scalarList", () => {
    describe("replaces old value with new one", () => {
      test.each([
        [null, []],
        [null, [null]],
        [null, [null, "foo"]],
        [[], [null]],
        [[null], []],
        [
          [null, "bar"],
          [null, "bar", null, "baz", null],
        ],
        [
          [null, "bar", null, "baz", null],
          [null, "bar"],
        ],
        [[null], [0]],
        [[0], [null]],
        [[0], [1]],
        [
          [null, "foo", null, "bar", null],
          [null, "bar", null, "baz", null],
        ],
      ])(`#%#: %p → %p`, (baseList, modelList) => {
        const base = completeObject({
          completeObjectList: [completeObject({ scalarList: baseList })],
        });
        const model = completeObject({
          completeObjectList: [completeObject({ scalarList: modelList })],
        });

        const result = diffChunkCombinations(base, model);

        expect(result).toMatchObject({
          patches: [
            {
              op: "replace",
              path: ["completeObjectList", 0, "scalarList"],
              value: modelList,
            },
          ],
          stale: [],
        });
      });
    });

    describe("empty diff when no changes", () => {
      test.each([
        [null],
        [[]],
        [[null]],
        [[null, "bar"]],
        [[null, "bar", null, "baz", null]],
        [[0]],
      ])(`#%#: %p`, (value) => {
        const base = completeObject({
          completeObject: [completeObject({ scalarList: value })],
        });
        const model = completeObject({
          completeObject: [completeObject({ scalarList: value })],
        });
        const result = diffChunkCombinations(base, model);

        expect(result).toMatchObject({
          patches: [],
          stale: [],
        });
      });
    });
  });

  describe("item field change: entity", () => {
    describe("replaces old value with new one", () => {
      test.each([
        [null, "a"],
        ["a", null],
        ["a", "b"],
      ])(`#%#: %p → %p`, (oldValue, newValue) => {
        const base = completeObject({
          completeObjectList: [
            completeObject({ entity: keyToEntity(oldValue) }),
          ],
        });
        const model = completeObject({
          completeObjectList: [
            completeObject({ entity: keyToEntity(newValue) }),
          ],
        });
        const result = diffChunkCombinations(base, model);

        expect(result).toMatchObject({
          patches: [
            {
              op: "replace",
              path: ["completeObjectList", 0, "entity"],
              value: keyToEntity(newValue),
            },
          ],
          stale: [],
        });
      });
    });

    describe("empty diff when no changes", () => {
      test.each([
        [entityFoo(), entityFoo()],
        [entityFoo(), entityFoo({ foo: "nested-field-changed" })], // comparing by key, so nested fields are not compared
      ])("#%#: %p", (oldEntity, newEntity) => {
        const base = completeObject({
          completeObjectList: [completeObject({ entity: oldEntity })],
        });
        const model = completeObject({
          completeObjectList: [completeObject({ entity: newEntity })],
        });
        const result = diffChunkCombinations(base, model);

        expect(result).toMatchObject({
          patches: [],
          stale: [],
        });
      });
    });
  });

  describe("item field change: plainObject", () => {
    describe("replaces old value with new one", () => {
      test.each([
        [null, plainObjectFoo()],
        [plainObjectFoo(), null],
      ])(`#%#: %p → %p`, (oldValue, newValue) => {
        const base = completeObject({
          completeObjectList: [completeObject({ plainObject: oldValue })],
        });
        const model = completeObject({
          completeObjectList: [completeObject({ plainObject: newValue })],
        });
        const result = diffChunkCombinations(base, model);

        expect(result).toMatchObject({
          patches: [
            {
              op: "replace",
              path: ["completeObjectList", 0, "plainObject"],
              value: newValue,
            },
          ],
          stale: [],
        });
      });
    });

    describe("empty diff when no changes", () => {
      test.each([
        [plainObjectFoo(), plainObjectFoo()],
        [null, null],
      ])("#%#: %p", (oldValue, newValue) => {
        const base = completeObject({
          completeObjectList: [completeObject({ plainObject: oldValue })],
        });
        const model = completeObject({
          completeObjectList: [completeObject({ plainObject: newValue })],
        });
        const result = diffChunkCombinations(base, model);

        expect(result).toMatchObject({
          patches: [],
          stale: [],
        });
      });
    });
  });

  describe("replaces item with null", () => {
    test.each([
      [plainObjectFoo(), null],
      [null, plainObjectFoo()],
    ])(`#%#: %p → %p`, (oldValue, newValue) => {
      const base = completeObject({
        plainObjectList: [null, oldValue, null, plainObjectFoo({ foo: "bar" })],
      });
      const model = completeObject({
        plainObjectList: [null, newValue, null, plainObjectFoo({ foo: "bar" })],
      });
      const result = diffChunkCombinations(base, model);

      expect(result).toMatchObject({
        patches: [
          {
            op: "replace",
            path: ["plainObjectList", 1],
            value: newValue,
          },
        ],
        stale: [],
      });
    });
  });

  describe("detects removal of objects from the tail of the list", () => {
    it.each([
      [["a"], [], []],
      [[null, "a"], [null], [0]], // FIXME? [null]
      [["a", null], ["a"], [0]],
      [["a", "b"], ["a"], [0]],
      [["a", "b", "c"], ["a"], [0]],
      [
        ["a", "b", "c"],
        ["a", "b"],
        [0, 1],
      ],
    ])("#%#: %p → %p", (oldList, newList, expectedLayout) => {
      const base = completeObject({
        plainObjectList: oldList.map(keyToPlainObjectFoo),
      });
      const model = completeObject({
        plainObjectList: newList.map(keyToPlainObjectFoo),
      });

      const result = diffChunkCombinations(base, model);

      expect(result).toMatchObject({
        patches: [
          {
            op: "alterListLayout",
            path: ["plainObjectList"],
            value: expectedLayout,
          },
        ],
        stale: [],
      });
    });
  });

  describe("detects addition of objects to the tail of the list", () => {
    it.each([
      [[], [null], [null]],
      [[], ["a"], ["a"]],
      [[], ["a", "b"], ["a", "b"]],
      [["a"], ["a", "b"], [0, "b"]],
      [
        ["a", null],
        ["a", null, "b"],
        [0, 1, "b"],
      ], // FIXME??? [0, null, "b"]?
      [
        [null, "a", null],
        [null, "a", null, "b"],
        [0, 1, 2, "b"],
      ], // FIXME??? [null, 1, null, "b"]?
      [
        ["a", "b"],
        ["a", "b", "c"],
        [0, 1, "c"],
      ],
    ])("#%#: %p → %p", (oldList, newList, expectedLayout) => {
      const base = completeObject({
        plainObjectList: oldList.map(keyToPlainObjectFoo),
      });
      const model = completeObject({
        plainObjectList: newList.map(keyToPlainObjectFoo),
      });

      const result = diffChunkCombinations(base, model);

      expect(result).toMatchObject({
        patches: [
          {
            op: "alterListLayout",
            path: ["plainObjectList"],
            value: expectedLayout.map(keyToPlainObjectFoo),
          },
        ],
        stale: [],
      });
    });
  });

  it.todo("detects removal of objects from the head of the list");
  it.todo("detects addition of objects to the head of the list");

  describe("complex changes", () => {
    test.each([
      [
        ["foo1", "foo2", "foo3", "foo4"],
        ["foo1", "foo4"],
        // TODO: when detection of both - head and tail difference works, this should become
        // { op: "alterListLayout", path: ["plainObjectList"], value: [0, 3] }
        [
          { op: "replace", path: ["plainObjectList", 1, "foo"], value: "foo4" },
          { op: "alterListLayout", path: ["plainObjectList"], value: [0, 1] },
        ],
      ],
      [
        ["foo1", "foo2", "foo3", "foo4"],
        ["foo2", "foo3"],
        [
          { op: "replace", path: ["plainObjectList", 0, "foo"], value: "foo2" },
          { op: "replace", path: ["plainObjectList", 1, "foo"], value: "foo3" },
          { op: "alterListLayout", path: ["plainObjectList"], value: [0, 1] },
        ],
      ],
      [
        ["foo1", "foo2", "foo3", "foo4"],
        ["foo1", "foo2", "foo4"],
        [
          { op: "replace", path: ["plainObjectList", 2, "foo"], value: "foo4" },
          {
            op: "alterListLayout",
            path: ["plainObjectList"],
            value: [0, 1, 2],
          },
        ],
      ],
      [
        ["foo1", "foo2"],
        ["foo2"],
        [
          { op: "replace", path: ["plainObjectList", 0, "foo"], value: "foo2" },
          { op: "alterListLayout", path: ["plainObjectList"], value: [0] },
        ],
      ],
      [
        ["foo1", "foo2"],
        [null, "foo1"],
        [
          { op: "replace", path: ["plainObjectList", 0], value: null },
          { op: "replace", path: ["plainObjectList", 1, "foo"], value: "foo1" },
        ],
      ],
    ])("#%#: %p → %p", (oldList, newList, expectedPatches) => {
      const base = completeObject({
        plainObjectList: oldList.map(keyToPlainObjectFoo),
      });
      const model = completeObject({
        plainObjectList: newList.map(keyToPlainObjectFoo),
      });
      const result = diffChunkCombinations(base, model);

      expect(result).toMatchObject({
        patches: expectedPatches,
        stale: [],
      });
    });
  });
});

describe("diff connections", () => {
  // Edges are typically identified by 3-tuple [type name, parent node id, child node id]
  //  but for diffing purposes, it is enough to use listItemKey to compare them properly

  const testDiffEnv = (): TestDiffEnv => ({
    listItemKey: (item, index) =>
      !Array.isArray(item) &&
      (item as any)?.node?.id &&
      item.__typename?.endsWith("Edge")
        ? (item as any).node.id
        : index,
  });

  describe("produces empty diff for connections without changes", () => {
    it.each([
      [[]],
      [[null]],
      [[null, null]],
      [["a", null]],
      [[null, "a"]],
      [[null, "a", null]],
      [["a", "b"]],
      [["a", null, "b"]],
      [[null, "a", null, "b", null]],
    ])("#%#: %p", (nodeIds) => {
      const baseEdges = nodeIds.map((id) =>
        id
          ? entityFooEdge({
              cursor: `cursor-${id}`,
              node: entityFoo({ id: id }),
            })
          : null,
      );
      const base = completeObject({
        connection: entityFooConnection({
          edges: baseEdges,
        }),
      });
      const model = completeObject({
        connection: entityFooConnection({
          edges: cloneDeep(baseEdges),
        }),
      });
      const result = diffChunkCombinations(base, model, testDiffEnv());

      expect(result).toMatchObject({
        patches: [],
        stale: [],
      });
    });
  });

  describe("detects removal of edges", () => {
    it.each([
      [["a"], [], []],
      [
        [null, "a", null],
        ["a", null],
        [1, null],
      ],
      [["a", null], [null], [null]],
      [
        ["a", "b", "c"],
        ["a", "b"],
        [0, 1],
      ],
      [
        ["a", "b", "c"],
        ["b", "c"],
        [1, 2],
      ],
      [
        ["a", "b", "c"],
        ["a", "c"],
        [0, 2],
      ],
    ])("#%#: %p → %p", (oldList, newList, expectedLayout) => {
      const base = completeObject({
        connection: entityFooConnection({ edges: oldList.map(keyToEdge) }),
      });
      const model = completeObject({
        connection: entityFooConnection({ edges: newList.map(keyToEdge) }),
      });

      const result = diffChunkCombinations(base, model, testDiffEnv());

      expect(result).toMatchObject({
        patches: [
          {
            op: "alterListLayout",
            path: ["connection", "edges"],
            value: expectedLayout,
          },
        ],
        stale: [],
      });
    });
  });

  describe("detects addition of edges", () => {
    it.each([
      [[], [null], [null]],
      [[], ["a"], ["a"]],
      [[null], ["a", null], ["a", null]],
      [
        ["a", "b"],
        ["a", "b", "c"],
        [0, 1, "c"],
      ],
      [
        ["b", "c"],
        ["a", "b", "c"],
        ["a", 0, 1],
      ],
      [
        ["a", "c"],
        ["a", "b", "c"],
        [0, "b", 1],
      ],
    ])("#%#: %p → %p", (oldList, newList, expectedLayout) => {
      const base = completeObject({
        connection: entityFooConnection({ edges: oldList.map(keyToEdge) }),
      });
      const model = completeObject({
        connection: entityFooConnection({ edges: newList.map(keyToEdge) }),
      });

      const result = diffChunkCombinations(base, model, testDiffEnv());

      expect(result).toMatchObject({
        patches: [
          {
            op: "alterListLayout",
            path: ["connection", "edges"],
            value: expectedLayout.map(keyToEdge),
          },
        ],
        stale: [],
      });
    });
  });

  describe("detects changed edge order", () => {
    it.each([
      [
        ["a", null],
        [null, "a"],
        [null, 0],
      ],
      [
        ["a", "b", "c"],
        ["b", "a", "c"],
        [1, 0, 2],
      ],
      [
        ["a", "b", "c"],
        ["a", "c", "b"],
        [0, 2, 1],
      ],
      [
        ["a", "b", "c"],
        ["c", "b", "a"],
        [2, 1, 0],
      ],
      [
        ["a", "b", "c"],
        ["c", "a", "b"],
        [2, 0, 1],
      ],
    ])("#%#: %p → %p", (oldList, newList, expectedLayout) => {
      const base = completeObject({
        connection: entityFooConnection({ edges: oldList.map(keyToEdge) }),
      });
      const model = completeObject({
        connection: entityFooConnection({ edges: newList.map(keyToEdge) }),
      });

      const result = diffChunkCombinations(base, model, testDiffEnv());

      expect(result).toMatchObject({
        patches: [
          {
            op: "alterListLayout",
            path: ["connection", "edges"],
            value: expectedLayout.map(keyToEdge),
          },
        ],
        stale: [],
      });
    });
  });

  describe("correctly nullifies edges", () => {
    it.each([
      [
        ["a", "b", "c"],
        ["a", "b", null],
        [0, 1, null],
      ],
      [
        ["a", "b", "c"],
        ["a", null, "c"],
        [0, null, 2],
      ],
      [
        ["a", "b", "c"],
        [null, "b", "c"],
        [null, 1, 2],
      ],
      [
        ["a", "b", "c"],
        [null, null, "c"],
        [null, null, 2],
      ],
      [
        ["a", "b", "c"],
        [null, null, null],
        [null, null, null],
      ],
    ])("#%#: %p → %p", (oldList, newList, expectedLayout) => {
      const base = completeObject({
        connection: entityFooConnection({ edges: oldList.map(keyToEdge) }),
      });
      const model = completeObject({
        connection: entityFooConnection({ edges: newList.map(keyToEdge) }),
      });

      const result = diffChunkCombinations(base, model, testDiffEnv());

      expect(result).toMatchObject({
        patches: [
          {
            op: "alterListLayout",
            path: ["connection", "edges"],
            value: expectedLayout.map(keyToEdge),
          },
        ],
        stale: [],
      });
    });
  });

  describe("correctly replaces nullified edges", () => {
    it.each([
      [
        ["a", "b", null],
        ["a", "b", "c"],
        [0, 1, "c"],
      ],
      [
        ["a", null, "c"],
        ["a", "b", "c"],
        [0, "b", 2],
      ],
      [
        [null, "b", "c"],
        ["a", "b", "c"],
        ["a", 1, 2],
      ],
      [
        [null, null, "c"],
        ["a", "b", "c"],
        ["a", "b", 2],
      ],
      [
        [null, null, null],
        ["a", "b", "c"],
        ["a", "b", "c"],
      ],
    ])("#%#: %p → %p", (oldList, newList, expectedLayout) => {
      const base = completeObject({
        connection: entityFooConnection({ edges: oldList.map(keyToEdge) }),
      });
      const model = completeObject({
        connection: entityFooConnection({ edges: newList.map(keyToEdge) }),
      });

      const result = diffChunkCombinations(base, model, testDiffEnv());

      expect(result).toMatchObject({
        patches: [
          {
            op: "alterListLayout",
            path: ["connection", "edges"],
            value: expectedLayout.map(keyToEdge),
          },
        ],
        stale: [],
      });
    });
  });
});

describe("diff lists kitchen-sink: complex lists layout changes", () => {
  it.each([
    [
      ["a", plainObjectFoo(), "b"],
      ["b", plainObjectFoo(), "a"],
      [2, 1, 0],
    ],
    [
      ["a", plainObjectFoo(), "b"],
      [plainObjectFoo(), "b", "a"],
      [1, 2, 0],
    ],
    [
      ["a", "b", "c"],
      [null, "c", "b", "d", "e"],
      [null, 2, 1, "d", "e"],
    ],
    [
      [null, "c", "b", "d", "e"],
      ["a", "b", null, "c"],
      ["a", 2, null, 1],
    ],
  ])("#%#: %p → %p", (oldList, newList, expectedLayout) => {
    const base = completeObject({
      entityOrPlainObjectUnionList: oldList.map(keyToEntity),
    });
    const model = completeObject({
      entityOrPlainObjectUnionList: newList.map(keyToEntity),
    });

    const result = diffChunkCombinations(base, model);

    expect(result).toMatchObject({
      patches: [
        {
          op: "alterListLayout",
          path: ["entityOrPlainObjectUnionList"],
          value: expectedLayout.map(keyToEntity),
        },
      ],
      stale: [],
    });
  });
});

describe("diff abstract types", () => {
  test.todo("interface types");
  test.todo("union types");
});

describe("diff model with missing fields", () => {
  test("detects fields that are expected to be in the model, but are missing", () => {
    const base = completeObject();
    const model = objectWithMissingFields();

    const { result } = diff(base, model);
    const errors = getMissingFieldErrors(result);

    expect(errors.length).toEqual(1);
    expect(errors[0].chunk.data).toEqual(model);
    expect(errors[0].missingFields.map((f) => f.dataKey)).toEqual([
      "scalar",
      "scalarList",
      "plainObject",
      "plainObjectList",
      "entity",
      "entityList",
      "entityOrPlainObjectUnionList",
      "connection",
      "plainObjectUnion",
      "plainObjectUnionList",
      "plainObjectInterface",
      "plainObjectInterfaceList",
      "completeObject",
      "completeObjectList",
    ]);
    expect(result.difference).toEqual(undefined);
  });

  test("detects missing model fields with @include(if: true)", () => {
    const base = completeObject({ maybeInclude: "true" });
    const model = completeObject({ maybeInclude: undefined }); // bad value
    const variables = { includeOptional: true };

    const { result, patches } = diff(base, model, variables, variables);
    const errors = getMissingFieldErrors(result);

    expect(patches.length).toEqual(0);
    expect(errors.length).toEqual(1);
    expect(errors[0].chunk.data).toEqual(model);
    expect(errors[0].missingFields).toMatchObject([
      {
        name: "scalar",
        args: new Map([["simple", { kind: "BooleanValue", value: true }]]),
      },
    ]);
  });

  test("detects missing model fields with @skip(if: true)", () => {
    const base = completeObject({ maybeSkip: "true" });
    const model = completeObject({ maybeSkip: undefined }); // undefined is the same as missing
    const variables = { skipOptional: false };

    const { result, patches } = diff(base, model, variables, variables);
    const errors = getMissingFieldErrors(result);

    expect(patches.length).toEqual(0);
    expect(errors.length).toEqual(1);
    expect(errors[0].chunk.data).toEqual(model);
    expect(errors[0].missingFields).toMatchObject([
      {
        name: "scalar",
        args: new Map([["simple", { kind: "BooleanValue", value: false }]]),
      },
    ]);
  });
});

describe("diff against base with missing fields", () => {
  test("fills gaps in base object", () => {
    const base = objectWithMissingFields();
    const model = completeObject();

    const { result, patches } = diff(base, model);
    const errors = getMissingFieldErrors(result);

    expect(errors.length).toEqual(0);
    expect(patches.map((p) => p.path[0])).toEqual([
      "scalar",
      "scalarList",
      "plainObject",
      "plainObjectList",
      "entity",
      "entityList",
      "entityOrPlainObjectUnionList",
      "connection",
      "plainObjectUnion",
      "plainObjectUnionList",
      "plainObjectInterface",
      "plainObjectInterfaceList",
      "completeObject",
      "completeObjectList",
    ]);
    expect(patches.map((p) => p.value === model[p.path[0]]));
    expect(patches.every((p) => p.op === "fill")).toBeTruthy();
  });

  test("returns incomplete difference for field with different arguments", () => {
    const forestEnv = {
      objectKey: (obj: any) => obj.id,
    };
    const diffEnv = {};
    const doc = gql`
      query ($arg: String) {
        foo(arg: $arg)
      }
    `;
    const foo1 = createTestOperation(doc, { arg: "" });
    const foo2 = createTestOperation(doc, { arg: "value" });

    const base = indexObject(
      forestEnv,
      foo1,
      {} as SourceObject,
      foo1.possibleSelections,
    );
    const model = indexObject(
      forestEnv,
      foo2,
      { foo: "value" } as unknown as SourceObject,
      foo2.possibleSelections,
    );
    const { difference } = diffObject(base.value, model.value, diffEnv);

    expect(difference).toBeDefined();
    assert(difference);
    expect(isComplete(difference)).toBe(false);
    expect(isDirty(difference)).toBe(false);
  });
});

describe("kitchen-sink", () => {
  // Place for edge-cases and regressions that are hard to categorize otherwise
});

function keyToEntity(keyOrOther: string | unknown) {
  return typeof keyOrOther === "string"
    ? entityFoo({ id: keyOrOther })
    : keyOrOther;
}

function keyToPlainObjectFoo(keyOrOther: string | unknown): any {
  return typeof keyOrOther === "string"
    ? keyToPlainObjectFoo({ foo: keyOrOther })
    : keyOrOther;
}

function keyToEdge(keyOrOther: string | unknown) {
  return typeof keyOrOther === "string"
    ? entityFooEdge({
        cursor: `cursor-${keyOrOther}`,
        node: entityFoo({ id: keyOrOther }),
      })
    : keyOrOther;
}

function diff(
  baseObj: SourceObject,
  modelObj: SourceObject,
  baseVariables?: VariableValues,
  modelVariables?: VariableValues,
  testEnv?: TestDiffEnv,
) {
  const env = {
    objectKey: (obj: any) => obj.id,
    ...testEnv,
  };
  const baseOperation = createTestOperation(completeObjectDoc, baseVariables);
  const modelOperation = createTestOperation(completeObjectDoc, modelVariables);
  const dataMap = new Map();

  // FIXME: this should use createObjectChunk vs indexObject
  const baseChunk = indexObject(
    env,
    baseOperation,
    baseObj,
    baseOperation.possibleSelections,
    undefined,
    dataMap,
  ).value;
  const modelChunk = indexObject(
    env,
    modelOperation,
    modelObj,
    modelOperation.possibleSelections,
    undefined,
    dataMap,
  ).value;
  const pathEnv: TraverseEnv = {
    findParent: createParentLocator(dataMap),
  };
  const base = createObjectAggregate([baseChunk]);
  const model = createObjectAggregate([modelChunk]);

  const result = diffObject(base, model, env);

  return {
    result,
    base,
    model,
    baseChunk,
    modelChunk,
    env,
    pathEnv,
    get patches() {
      return createPatches(pathEnv, baseChunk, result.difference);
    },
  };
}

type TestDiffEnv = Partial<DiffEnv>;

function diffChunkCombinations(
  baseObj: any,
  modelObj: any,
  testEnv?: TestDiffEnv,
) {
  // Default diff with single chunks
  const { baseChunk, modelChunk, env, patches, result, pathEnv } = diff(
    baseObj,
    modelObj,
    undefined,
    undefined,
    testEnv,
  );

  // Sanity-checks: different chunking combinations should produce diffs identical to single-chunk diff
  diffChunkPerField(baseChunk, modelChunk, env, pathEnv, result);
  diffChunkPerFieldReversed(baseChunk, modelChunk, env, pathEnv, result);
  diffChunkPerFieldDuplicates(baseChunk, modelChunk, env, pathEnv, result);

  return {
    // difference: result.difference,
    patches,
    stale: [],
  };
}

function diffChunkPerField(
  baseChunk: ObjectChunk,
  modelChunk: ObjectChunk,
  env: DiffEnv,
  pathEnv: TraverseEnv,
  expectedDiff: ObjectDiffState,
) {
  const base = createObjectAggregate(chunkPerField(env, baseChunk));
  const model = createObjectAggregate(chunkPerField(env, modelChunk));

  const diff = diffObject(base, model, env);
  const diff1 = diffObject(base, createObjectAggregate([modelChunk]), env);
  const diff2 = diffObject(createObjectAggregate([baseChunk]), model, env);

  // Diffs contain recursive structures which are hard to compare directly, so comparing patches instead
  const expectedPatches = createPatches(
    pathEnv,
    baseChunk,
    expectedDiff.difference,
  );

  const patches = createPatches(pathEnv, baseChunk, diff.difference);
  const patches1 = createPatches(pathEnv, baseChunk, diff1.difference);
  const patches2 = createPatches(pathEnv, baseChunk, diff2.difference);

  expect(patches).toEqual(expectedPatches);
  expect(patches1).toEqual(expectedPatches);
  expect(patches2).toEqual(expectedPatches);
}

function diffChunkPerFieldReversed(
  baseChunk: ObjectChunk,
  modelChunk: ObjectChunk,
  env: DiffEnv,
  pathEnv: TraverseEnv,
  expectedDiff: ObjectDiffState,
) {
  const baseWithReversedChunks = createObjectAggregate(
    chunkPerField(env, baseChunk).reverse(),
  );
  const modelWithReversedChunks = createObjectAggregate(
    chunkPerField(env, modelChunk).reverse(),
  );

  const diffReversed = diffObject(
    baseWithReversedChunks,
    modelWithReversedChunks,
    env,
  );
  const diffReversed1 = diffObject(
    baseWithReversedChunks,
    createObjectAggregate([modelChunk]),
    env,
  );
  const diffReversed2 = diffObject(
    createObjectAggregate([baseChunk]),
    modelWithReversedChunks,
    env,
  );

  const expectedPatches = createPatches(
    pathEnv,
    baseChunk,
    expectedDiff.difference,
  );

  const patches = createPatches(pathEnv, baseChunk, diffReversed.difference);
  const patches1 = createPatches(pathEnv, baseChunk, diffReversed1.difference);
  const patches2 = createPatches(pathEnv, baseChunk, diffReversed2.difference);

  expect(patches).toEqual(expectedPatches);
  expect(patches1).toEqual(expectedPatches);
  expect(patches2).toEqual(expectedPatches);
}

function diffChunkPerFieldDuplicates(
  baseChunk: ObjectChunk,
  modelChunk: ObjectChunk,
  env: DiffEnv,
  pathEnv: TraverseEnv,
  expectedDiff: ObjectDiffState,
) {
  const baseWithDuplicateChunks = createObjectAggregate([
    ...chunkPerField(env, baseChunk).reverse(),
    ...chunkPerField(env, baseChunk),
  ]);
  const modelWithDuplicateChunks = createObjectAggregate([
    ...chunkPerField(env, modelChunk).reverse(),
    ...chunkPerField(env, modelChunk),
  ]);
  const diffDuplicates = diffObject(
    baseWithDuplicateChunks,
    modelWithDuplicateChunks,
    env,
  );
  const diffDuplicates1 = diffObject(
    baseWithDuplicateChunks,
    createObjectAggregate([modelChunk]),
    env,
  );
  const diffDuplicates2 = diffObject(
    createObjectAggregate([baseChunk]),
    modelWithDuplicateChunks,
    env,
  );

  const expectedPatches = createPatches(
    pathEnv,
    baseChunk,
    expectedDiff.difference,
  );
  const patches = createPatches(pathEnv, baseChunk, diffDuplicates.difference);
  const patches1 = createPatches(
    pathEnv,
    baseChunk,
    diffDuplicates1.difference,
  );
  const patches2 = createPatches(
    pathEnv,
    baseChunk,
    diffDuplicates2.difference,
  );

  expect(patches).toEqual(expectedPatches);
  expect(patches1).toEqual(expectedPatches);
  expect(patches2).toEqual(expectedPatches);
}

// Creates multiple chunks from a single source chunk: one chunk per source field
// (aggregated object value should be identical in terms of diffing)
function chunkPerField(env: DiffEnv, sourceChunk: ObjectChunk): ObjectChunk[] {
  const chunks: ObjectChunk[] = [];
  const selection = sourceChunk.possibleSelections.get(
    sourceChunk.data.__typename ?? null,
  );
  assert(selection);

  for (const [name, fieldInfo] of selection.fields.entries()) {
    const possibleSelections: PossibleSelections = new Map([
      [
        sourceChunk.data.__typename ?? null,
        {
          depth: selection.depth,
          fields: new Map([[name, fieldInfo]]),
          fieldQueue: [...fieldInfo],
          fieldsWithSelections: selection.fieldsWithSelections?.includes(name)
            ? [name]
            : [],
        },
      ],
    ]);
    const objectChunk = {
      __typename: sourceChunk.data.__typename,
    } as SourceObject;
    for (const alias of fieldInfo) {
      objectChunk[alias.dataKey] = sourceChunk.data[alias.dataKey];
    }
    const forestEnv = {
      objectKey: (obj: any) => obj.id,
    };
    // FIXME: this should use createObjectChunk instead of indexing
    const chunk = indexObject(
      forestEnv,
      sourceChunk.operation,
      objectChunk,
      possibleSelections,
    );
    chunks.push(chunk.value);
  }
  return chunks;
}

function getMissingFieldErrors(
  result: ObjectDiffState,
): MissingModelFieldsError[] {
  return (
    result.errors?.filter(
      (error): error is MissingModelFieldsError =>
        error.kind === DiffErrorKind.MissingModelFields,
    ) ?? []
  );
}
