import { DocumentNode } from "graphql";
import { updateTree } from "../updateTree";
import { gql, createTestOperation } from "../../__tests__/helpers/descriptor";
import {
  completeObject,
  completeObjectDoc,
  entityFoo,
  entityFooConnection,
  entityFooEdge,
  plainObjectFoo,
  plainObjectBar,
  objectWithMissingFields,
} from "../../__tests__/helpers/completeObject";
import {
  addForestTree,
  createTestForest,
  createTestTree,
} from "../../__tests__/helpers/forest";
import { IndexedTree, ForestEnv } from "../types";
import { SourceObject } from "../../values/types";
import { VariableValues } from "../../descriptor/types";
import { diffTree, GraphDifference } from "../../diff/diffTree";
import { cloneDeep, maybeDeepFreeze } from "@apollo/client/utilities";
import { DiffEnv } from "../../diff/types";

test("no-op when there are no changes", () => {
  const before = completeObject();
  const after = completeObject();
  const { data } = diffAndUpdate(before, after);

  expect(data).toEqual(after);
  expect(data).toBe(before);
  expect(data).not.toBe(after);
});

describe("update scalars", () => {
  describe("replaces old scalar value with new one", () => {
    it.each([
      [true, false],
      [false, true],
      [``, `new`],
      [`old`, ``],
      [`old`, `new`],
      [-1, 0],
      [Number.MIN_VALUE, 0],
    ])(`#%#: %p with %p`, (oldValue, newValue) => {
      const base = completeObject({ scalar: oldValue });
      const model = completeObject({ scalar: newValue });

      const { data } = diffAndUpdate(base, model);

      expect(data).toEqual(model);
      expect(data).not.toBe(model);
      expect(data).not.toBe(base);
    });

    describe("replaces null with scalar value", () => {
      it.each([["test"], [""], [0], [1], [-1], [2.55], [1e5], [true], [false]])(
        "#%#: %p",
        (newValue) => {
          const base = completeObject({ scalar: null });
          const model = completeObject({ scalar: newValue });

          const { data } = diffAndUpdate(base, model);

          expect(data).toEqual(model);
          expect(data).not.toBe(model);
          expect(data).not.toBe(base);
        },
      );
    });

    describe("replaces scalars with null", () => {
      it.each([["test"], [""], [0], [1], [-1], [2.55], [1e5], [true], [false]])(
        "#%#: %p",
        (oldValue) => {
          const base = completeObject({ scalar: oldValue });
          const model = completeObject({ scalar: null });

          const { data } = diffAndUpdate(base, model);

          expect(data).toEqual(model);
          expect(data).not.toBe(model);
          expect(data).not.toBe(base);
        },
      );
    });
  });
});

describe("update list of scalars", () => {
  it("replaces null with a list", () => {
    const modelList = [null, "foo", null, "bar", null];
    const base = completeObject({ scalarList: null });
    const model = completeObject({ scalarList: modelList });

    const { data } = diffAndUpdate(base, model);

    expect(data).toEqual(model);
    expect(data).not.toBe(model);
    expect(data).not.toBe(base);
  });

  it("replaces a list with different length", () => {
    const baseList = [null, "foo"];
    const modelList = [null, "foo", null, "bar", null];
    const base = completeObject({ scalarList: baseList });
    const model = completeObject({ scalarList: modelList });

    const { data } = diffAndUpdate(base, model);

    expect(data).toEqual(model);
    expect(data).not.toBe(model);
    expect(data).not.toBe(base);
  });

  it("replaces a list with a different list of the same length", () => {
    const baseList = [null, "foo", null, "bar", null];
    const modelList = [null, "bar", null, "baz", null];
    const base = completeObject({ scalarList: baseList });
    const model = completeObject({ scalarList: modelList });

    const { data } = diffAndUpdate(base, model);

    expect(data).toEqual(model);
    expect(data).not.toBe(model);
    expect(data).not.toBe(base);
  });

  it("preserves the same list when there are no changes", () => {
    const baseList = [null, "foo", null, "bar", null];
    const modelList = [null, "foo", null, "bar", null];

    const base = completeObject({ scalarList: baseList });
    const model = completeObject({ scalarList: modelList });

    const { data } = diffAndUpdate(base, model);

    expect(data).toBe(base);
    expect(data).toEqual(model);
    expect(data).not.toBe(model);
  });
});

describe("update identifiable objects", () => {
  it("preserve the same object when entity has the same key", () => {
    const base = completeObject({
      entity: entityFoo(),
    });
    const model = completeObject({
      entity: entityFoo(),
    });
    const { data } = diffAndUpdate(base, model);

    expect(data).toBe(base);
    expect(data).not.toBe(model);
    expect(data).toEqual(model);
  });

  it("replaces null with entity", () => {
    const base = completeObject({
      entity: null,
    });
    const model = completeObject({
      entity: entityFoo(),
    });
    const { data } = diffAndUpdate(base, model);

    expect(data).toEqual(model);
    expect(data).not.toBe(model);
    expect(data).not.toBe(base);
  });

  it("replaces entity with null", () => {
    const base = completeObject({
      entity: entityFoo(),
    });
    const model = completeObject({
      entity: null,
    });
    const { data } = diffAndUpdate(base, model);

    expect(data).toEqual(model);
    expect(data).not.toBe(model);
    expect(data).not.toBe(base);
  });

  it("replaces entity with another entity", () => {
    const baseEntity = entityFoo({ id: "1" });
    const modelEntity = entityFoo({ id: "2" });

    const base = completeObject({ entity: baseEntity });
    const model = completeObject({ entity: modelEntity });

    const { data } = diffAndUpdate(base, model);

    expect(data).toEqual(model);
    expect(data).not.toBe(model);
    expect(data).not.toBe(base);
  });
});

describe("update plain objects", () => {
  it("preserve the same object when there are no changes", () => {
    const base = completeObject({ foo: plainObjectFoo() });
    const model = completeObject({ foo: plainObjectFoo() });

    const { data } = diffAndUpdate(base, model);

    expect(data).toBe(base);
    expect(data).toEqual(model);
    expect(data).not.toBe(model);
  });

  describe("scalar field", () => {
    describe("replaces scalar field with new value", () => {
      it.each([
        [``, `new`],
        [`old`, ``],
        [`old`, `new`],
        [-1, 0],
        [Number.MIN_VALUE, 0],
        [true, false],
        [false, true],
      ])(`#%#: %p with %p`, (oldValue, newValue) => {
        const base = completeObject({
          completeObject: completeObject({ scalar: oldValue }),
        });
        const model = completeObject({
          completeObject: completeObject({ scalar: newValue }),
        });
        const { data } = diffAndUpdate(base, model);

        expect(data).toEqual(model);
        expect(data).not.toBe(model);
        expect(data).not.toBe(base);
      });
    });

    describe("replaces null field with scalar value", () => {
      it.each([["test"], [""], [0], [1], [-1], [2.55], [1e5], [true], [false]])(
        "#%#: %p",
        (newValue) => {
          const base = completeObject({
            completeObject: completeObject({ scalar: null }),
          });
          const model = completeObject({
            completeObject: completeObject({ scalar: newValue }),
          });
          const { data } = diffAndUpdate(base, model);

          expect(data).toEqual(model);
          expect(data).not.toBe(model);
          expect(data).not.toBe(base);
        },
      );
    });

    describe("replaces scalar field with null value", () => {
      it.each([["test"], [""], [0], [1], [-1], [2.55], [1e5], [true], [false]])(
        "#%#: %p",
        (oldValue) => {
          const base = completeObject({
            completeObject: completeObject({ scalar: oldValue }),
          });
          const model = completeObject({
            completeObject: completeObject({ scalar: null }),
          });

          const { data } = diffAndUpdate(base, model);

          expect(data).toEqual(model);
          expect(data).not.toBe(model);
          expect(data).not.toBe(base);
        },
      );
    });
  });

  describe("scalarList field", () => {
    describe("replaces null field with a list of scalars", () => {
      it.each([[[]], [[null]], [[null, "foo"]]])(
        "#%#: null with %p",
        (modelList) => {
          const baseList = null;
          const base = completeObject({
            completeObject: completeObject({ scalarList: baseList }),
          });
          const model = completeObject({
            completeObject: completeObject({ scalarList: modelList }),
          });

          const { data } = diffAndUpdate(base, model);

          expect(data).toEqual(model);
          expect(data).not.toBe(model);
          expect(data).not.toBe(base);
        },
      );
    });

    describe("replaces a list of scalars with different length", () => {
      it.each([
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
      ])("#%#: %p → %p", (baseList, modelList) => {
        const base = completeObject({
          completeObject: completeObject({ scalarList: baseList }),
        });
        const model = completeObject({
          completeObject: completeObject({ scalarList: modelList }),
        });

        const { data } = diffAndUpdate(base, model);

        expect(data).toEqual(model);
        expect(data).not.toBe(model);
        expect(data).not.toBe(base);
      });
    });

    describe("replaces a list with a different list of the same length", () => {
      it.each([
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

        const { data } = diffAndUpdate(base, model);

        expect(data).toEqual(model);
        expect(data).not.toBe(model);
        expect(data).not.toBe(base);
      });
    });

    describe("preserves the same list of scalars when there are no changes", () => {
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

        const { data } = diffAndUpdate(base, model);

        expect(data).toBe(base);
        expect(data).toEqual(model);
        expect(data).not.toBe(model);
      });
    });
  });

  describe("entity field", () => {
    it("preserve the same object when entity has the same key", () => {
      const base = completeObject({
        completeObject: completeObject({ entity: entityFoo() }),
      });
      const model = completeObject({
        completeObject: completeObject({ entity: entityFoo() }),
      });
      const { data } = diffAndUpdate(base, model);

      expect(data).toBe(base);
      expect(data).toEqual(model);
      expect(data).not.toBe(model);
    });

    it("replaces null with entity", () => {
      const base = completeObject({
        completeObject: completeObject({ entity: null }),
      });
      const model = completeObject({
        completeObject: completeObject({ entity: entityFoo() }),
      });
      const { data } = diffAndUpdate(base, model);

      expect(data).toEqual(model);
      expect(data).not.toBe(model);
      expect(data).not.toBe(base);
    });

    it("replaces entity with null", () => {
      const base = completeObject({
        completeObject: completeObject({ entity: entityFoo() }),
      });
      const model = completeObject({
        completeObject: completeObject({ entity: null }),
      });
      const { data } = diffAndUpdate(base, model);

      expect(data).toEqual(model);
      expect(data).not.toBe(model);
      expect(data).not.toBe(base);
    });

    it("replaces entity with another entity", () => {
      const baseEntity = entityFoo({ id: "1" });
      const modelEntity = entityFoo({ id: "2" });

      const base = completeObject({
        completeObject: completeObject({ entity: baseEntity }),
      });
      const model = completeObject({
        completeObject: completeObject({ entity: modelEntity }),
      });
      const { data } = diffAndUpdate(base, model);

      expect(data).toEqual(model);
      expect(data).not.toBe(model);
      expect(data).not.toBe(base);
    });
  });

  describe("plainObject field", () => {
    it("replaces null field with plain object", () => {
      // Note: assuming model selectionSet includes base selectionSet (top describe block)
      const base = completeObject({
        completeObject: completeObject({ plainObject: null }),
      });
      const model = completeObject({
        completeObject: completeObject({ plainObject: plainObjectFoo() }),
      });
      const { data } = diffAndUpdate(base, model);

      expect(data).toEqual(model);
      expect(data).not.toBe(model);
      expect(data).not.toBe(base);
    });

    it("replaces nested null field with plain object", () => {
      // Note: assuming model selectionSet includes base selectionSet (top describe block)
      const base = completeObject({
        completeObject: completeObject({ plainObject: null }),
      });
      const model = completeObject({
        completeObject: completeObject({ plainObject: plainObjectFoo() }),
      });
      const { data } = diffAndUpdate(base, model);

      expect(data).toEqual(model);
      expect(data).not.toBe(model);
      expect(data).not.toBe(base);
    });
  });
});

describe("update lists of entities", () => {
  describe("preserves the same object for lists without changes", () => {
    it.each([
      [[]],
      [[null]],
      [[null, null]],
      [[null, "a", null]],
      [["a"]],
      [["a", "b"]],
    ])("#%#: %p", (baseListKeys) => {
      const baseList = baseListKeys.map((id) => entityFoo({ id }));
      const base = completeObject({
        entityList: baseList,
      });
      const model = completeObject({
        entityList: cloneDeep(baseList),
      });
      const { data } = diffAndUpdate(base, model);

      expect(data).toBe(base);
      expect(data).not.toBe(model);
      expect(data).toEqual(model);
    });
  });

  describe("removes entities from the list", () => {
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
      const { data } = diffAndUpdate(base, model);

      expect(data).toEqual(model);
      expect(data).not.toBe(model);
      expect(data).not.toBe(base);

      for (const [dataIndex, baseIndexOrValue] of expectedLayout.entries()) {
        const value = data.entityList[dataIndex];
        if (typeof baseIndexOrValue === "number") {
          expect(value).toBe(base.entityList[baseIndexOrValue]);
        } else {
          expect(value).toBe(baseIndexOrValue);
        }
      }
    });
  });

  describe("adds entities to the list", () => {
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
      const { data } = diffAndUpdate(base, model);

      expect(data).toEqual(model);
      expect(data).not.toBe(model);
      expect(data).not.toBe(base);

      for (const [dataIndex, baseIndexOrKey] of expectedLayout.entries()) {
        const value = data.entityList[dataIndex];
        if (typeof baseIndexOrKey === "number") {
          expect(value).toBe(base.entityList[baseIndexOrKey]);
        } else {
          expect(value).toEqual(keyToEntity(baseIndexOrKey));
        }
      }
    });
  });

  describe("changes entity order", () => {
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

      const { data } = diffAndUpdate(base, model);

      expect(data).toEqual(model);
      expect(data).not.toBe(model);
      expect(data).not.toBe(base);

      for (const [dataIndex, baseIndexOrNull] of expectedLayout.entries()) {
        const value = data.entityList[dataIndex];
        if (typeof baseIndexOrNull === "number") {
          expect(value).toBe(base.entityList[baseIndexOrNull]);
        } else {
          expect(value).toEqual(null);
        }
      }
    });
  });

  describe("correctly nullifies entities in the list", () => {
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

      const { data } = diffAndUpdate(base, model);

      expect(data).toEqual(model);
      expect(data).not.toBe(model);
      expect(data).not.toBe(base);

      for (const [dataIndex, baseIndexOrNull] of expectedLayout.entries()) {
        const value = data.entityList[dataIndex];
        if (typeof baseIndexOrNull === "number") {
          expect(value).toBe(base.entityList[baseIndexOrNull]);
        } else {
          expect(value).toEqual(null);
        }
      }
    });
  });

  describe("correctly replaces nullified entities in the list", () => {
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

      const { data } = diffAndUpdate(base, model);

      expect(data).toEqual(model);
      expect(data).not.toBe(model);
      expect(data).not.toBe(base);

      for (const [dataIndex, baseIndexOrKey] of expectedLayout.entries()) {
        const value = data.entityList[dataIndex];
        if (typeof baseIndexOrKey === "number") {
          expect(value).toBe(base.entityList[baseIndexOrKey]);
        } else {
          expect(value).toEqual(keyToEntity(baseIndexOrKey));
        }
      }
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

      const { data } = diffAndUpdate(base, model);

      expect(data).toEqual(model);
      expect(data).not.toBe(model);
      expect(data).not.toBe(base);

      for (const [dataIndex, baseIndexOrNull] of expectedLayout.entries()) {
        const value = data.entityList[dataIndex];
        if (typeof baseIndexOrNull === "number") {
          expect(value).toBe(base.entityList[baseIndexOrNull]);
        } else {
          expect(value).toEqual(null);
        }
      }
    });
  });
});

describe("update lists of plain objects", () => {
  describe("preserves the same object when there are changes", () => {
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
      const { data } = diffAndUpdate(base, model);

      expect(data).toBe(base);
      expect(data).not.toBe(model);
      expect(data).toEqual(model);
    });
  });

  describe("replaces nested scalar field with new value", () => {
    it.each([
      [true, false],
      [false, true],
      [``, `new`],
      [`old`, ``],
      [`old`, `new`],
      [-1, 0],
      [0, -1],
      [Number.MIN_VALUE, 0],
      [null, `new`],
      [`new`, null],
    ])(`#%#: %p with %p`, (oldValue, newValue) => {
      const original = completeObject({ scalar: oldValue });
      const changed = completeObject({ scalar: newValue });

      const base = completeObject({
        completeObjectList: [null, original, null, completeObject()],
      });
      const model = completeObject({
        completeObjectList: [null, changed, null, completeObject()],
      });
      const { data } = diffAndUpdate(base, model);

      expect(data).toEqual(model);
      expect(data).not.toBe(base);
      expect(data).not.toBe(model);
    });
  });

  describe("replaces nested list of scalars", () => {
    it.each([[[]], [[null]], [[null, "foo"]]])(
      "#%#: null with %p",
      (modelList) => {
        const baseList = null;
        const base = completeObject({
          completeObjectList: [
            null,
            completeObject({ scalarList: baseList }),
            null,
          ],
        });
        const model = completeObject({
          completeObjectList: [
            null,
            completeObject({ scalarList: modelList }),
            null,
          ],
        });

        const { data } = diffAndUpdate(base, model);

        expect(data).toEqual(model);
        expect(data).not.toBe(base);
        expect(data).not.toBe(model);
      },
    );
  });

  describe("replaces nested list of scalars with a list of different length", () => {
    it.each([
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
    ])("#%#: %p → %p", (baseList, modelList) => {
      const base = completeObject({
        completeObjectList: [completeObject({ scalarList: baseList })],
      });
      const model = completeObject({
        completeObjectList: [completeObject({ scalarList: modelList })],
      });

      const { data } = diffAndUpdate(base, model);

      expect(data).toEqual(model);
      expect(data).not.toBe(base);
      expect(data).not.toBe(model);
    });
  });

  describe("replaces nested list of scalars with a different list of the same length", () => {
    it.each([
      [[null], [0]],
      [[0], [null]],
      [[0], [1]],
      [
        [null, "foo", null, "bar", null],
        [null, "bar", null, "baz", null],
      ],
    ])("#%#: %p → %p", (baseList, modelList) => {
      const base = completeObject({
        completeObjectList: [completeObject({ scalarList: baseList })],
      });
      const model = completeObject({
        completeObjectList: [completeObject({ scalarList: modelList })],
      });

      const { data } = diffAndUpdate(base, model);

      expect(data).toEqual(model);
      expect(data).not.toBe(base);
      expect(data).not.toBe(model);
    });
  });

  describe("preserves the same nested list of scalars when there are no changes", () => {
    it.each([
      [[]],
      [[null]],
      [[0]],
      [["foo"]],
      [[null, "foo", null, "bar", null]],
    ])("#%#: %p", (baseList) => {
      const modelList = [...baseList];
      const base = completeObject({
        completeObjectList: completeObject({ scalarList: baseList }),
      });
      const model = completeObject({
        completeObjectList: completeObject({ scalarList: modelList }),
      });
      const { data } = diffAndUpdate(base, model);

      expect(data).toBe(base);
      expect(data).not.toBe(model);
      expect(data).toEqual(model);
    });
  });

  describe("update nested entity field", () => {
    it("preserves the same object when entity has the same key", () => {
      const base = completeObject({
        completeObjectList: [completeObject({ entity: entityFoo() })],
      });
      const model = completeObject({
        completeObjectList: [completeObject({ entity: entityFoo() })],
      });
      const { data } = diffAndUpdate(base, model);

      expect(data).toBe(base);
      expect(data).not.toBe(model);
      expect(data).toEqual(model);
    });

    it("replaces null with entity", () => {
      const base = completeObject({
        completeObjectList: [completeObject({ entity: null })],
      });
      const model = completeObject({
        completeObjectList: [completeObject({ entity: entityFoo() })],
      });
      const { data } = diffAndUpdate(base, model);

      expect(data).toEqual(model);
      expect(data).not.toBe(model);
      expect(data).not.toBe(base);
    });

    it("replaces entity with null", () => {
      const base = completeObject({
        completeObjectList: [completeObject({ entity: entityFoo() })],
      });
      const model = completeObject({
        completeObjectList: [completeObject({ entity: null })],
      });
      const { data } = diffAndUpdate(base, model);

      expect(data).toEqual(model);
      expect(data).not.toBe(model);
      expect(data).not.toBe(base);
    });

    it("replaces entity with another entity", () => {
      const baseEntity = entityFoo({ id: "1" });
      const modelEntity = entityFoo({ id: "2" });

      const base = completeObject({
        completeObjectList: [completeObject({ entity: baseEntity })],
      });
      const model = completeObject({
        completeObjectList: [completeObject({ entity: modelEntity })],
      });
      const { data } = diffAndUpdate(base, model);

      expect(data).toEqual(model);
      expect(data).not.toBe(model);
      expect(data).not.toBe(base);
    });
  });

  describe("update nested plainObject field", () => {
    it("replaces null field with plain object", () => {
      const base = completeObject({
        completeObjectList: [completeObject({ plainObject: null })],
      });
      const model = completeObject({
        completeObjectList: [completeObject({ plainObject: plainObjectFoo() })],
      });
      const { data } = diffAndUpdate(base, model);

      expect(data).toEqual(model);
      expect(data).not.toBe(model);
      expect(data).not.toBe(base);
    });

    it("replaces nested null field with plain object", () => {
      // Note: assuming model selectionSet includes base selectionSet (top describe block)
      const base = completeObject({
        completeObjectList: [completeObject({ plainObject: null })],
      });
      const model = completeObject({
        completeObjectList: [completeObject({ plainObject: plainObjectFoo() })],
      });
      const { data } = diffAndUpdate(base, model);

      expect(data).toEqual(model);
      expect(data).not.toBe(model);
      expect(data).not.toBe(base);
    });
  });

  it("nullifies items", () => {
    const base = completeObject({
      plainObjectList: [
        null,
        plainObjectFoo(),
        null,
        plainObjectFoo({ foo: "other" }),
      ],
    });
    const model = completeObject({
      plainObjectList: [null, null, null, plainObjectFoo({ foo: "other" })],
    });
    const { data } = diffAndUpdate(base, model);

    expect(data).toEqual(model);
    expect(data).not.toBe(model);
    expect(data).not.toBe(base);
  });

  it("adds items", () => {
    const base = completeObject({
      plainObjectList: [null, plainObjectFoo(), null],
    });
    const model = completeObject({
      plainObjectList: [
        null,
        plainObjectFoo(),
        null,
        plainObjectFoo({ foo: "other" }),
      ],
    });
    const { data } = diffAndUpdate(base, model);

    expect(data).toEqual(model);
    expect(data).not.toBe(model);
    expect(data).not.toBe(base);
  });

  it("removes items", () => {
    const base = completeObject({
      plainObjectList: [
        null,
        plainObjectFoo(),
        null,
        plainObjectFoo({ foo: "bar" }),
      ],
    });
    const model = completeObject({
      plainObjectList: [null, plainObjectFoo(), null],
    });
    const { data } = diffAndUpdate(base, model);

    expect(data).toEqual(model);
    expect(data).not.toBe(model);
    expect(data).not.toBe(base);
  });

  describe("complex changes", () => {
    it("adds to empty array", () => {
      const base = completeObject({
        plainObjectList: [],
      });
      const model = completeObject({
        plainObjectList: [plainObjectFoo()],
      });
      const { data } = diffAndUpdate(base, model);

      expect(data).toEqual(model);
      expect(data).not.toBe(model);
      expect(data).not.toBe(base);
    });

    it("update list layout and change one item", () => {
      const base = completeObject({
        plainObjectList: [
          plainObjectFoo({ foo: "1" }),
          plainObjectFoo({ foo: "2" }),
          plainObjectFoo({ foo: "3" }),
          plainObjectFoo({ foo: "4" }),
        ],
      });
      const model = completeObject({
        plainObjectList: [
          plainObjectFoo({ foo: "1" }),
          plainObjectFoo({ foo: "4" }),
        ],
      });
      const { data } = diffAndUpdate(base, model);

      expect(data).toEqual(model);
      expect(data).not.toBe(model);
      expect(data).not.toBe(base);
      expect(data.plainObjectList[0]).toBe(base.plainObjectList[0]);
    });
  });
});

describe("update list of union type", () => {
  it("prepends item of a different plain object type", () => {
    const base = completeObject({
      plainObjectUnionList: [plainObjectFoo({ foo: "1" })],
    });
    const model = completeObject({
      plainObjectUnionList: [
        plainObjectBar({ bar: "1" }),
        plainObjectFoo({ foo: "1" }),
      ],
    });
    const { data } = diffAndUpdate(base, model);

    expect(data).toEqual(model);
    expect(data).not.toBe(model);
    expect(data).not.toBe(base);
  });

  it("appends item of a different plain object type", () => {
    const base = completeObject({
      plainObjectUnionList: [plainObjectFoo({ foo: "1" })],
    });
    const model = completeObject({
      plainObjectUnionList: [
        plainObjectFoo({ foo: "1" }),
        plainObjectBar({ bar: "1" }),
      ],
    });
    const { data } = diffAndUpdate(base, model);

    expect(data).toEqual(model);
    expect(data).not.toBe(model);
    expect(data).not.toBe(base);
  });

  it("inserts item of a different plain object type", () => {
    const base = completeObject({
      plainObjectUnionList: [
        plainObjectFoo({ foo: "1" }),
        plainObjectFoo({ foo: "2" }),
      ],
    });
    const model = completeObject({
      plainObjectUnionList: [
        plainObjectFoo({ foo: "1" }),
        plainObjectBar({ bar: "1" }),
        plainObjectFoo({ foo: "2" }),
      ],
    });
    const { data } = diffAndUpdate(base, model);

    expect(data).toEqual(model);
    expect(data).not.toBe(model);
    expect(data).not.toBe(base);
  });

  describe("update nested entity field", () => {
    it("prepends item of another type and modifies nested entity field", () => {
      const base = completeObject({
        plainObjectUnionList: [
          plainObjectFoo({
            foo: "2",
            entityUnion: entityFoo({ id: "2", foo: "foo2" }),
          }),
        ],
      });
      const model = completeObject({
        plainObjectUnionList: [
          plainObjectBar({
            bar: "1",
            entityUnion: entityFoo({ id: "1", foo: "foo1" }),
          }),
          plainObjectFoo({
            foo: "2",
            entityUnion: entityFoo({ id: "2", foo: "foo2-changed" }),
          }),
        ],
      });
      const { data } = diffAndUpdate(base, model);

      expect(data).toEqual(model);
      expect(data).not.toBe(model);
      expect(data).not.toBe(base);
    });
  });
});

describe("update connections", () => {
  // Edges are typically identified by 3-tuple [type name, parent node id, child node id]
  //  but for diffing purposes, it is enough to use listItemKey to compare them properly

  const testEnv = (): Partial<ForestEnv & DiffEnv> => ({
    listItemKey: (item, index) =>
      !Array.isArray(item) &&
      (item as any)?.node?.id &&
      item.__typename?.endsWith("Edge")
        ? (item as any).node.id
        : index,
  });

  describe("preserves the object when there are no changes", () => {
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
      const { data } = diffAndUpdate(base, model, testEnv());

      expect(data).toBe(base);
      expect(data).not.toBe(model);
      expect(data).toEqual(model);
    });
  });

  describe("removes edges", () => {
    it.each([
      [["a"], []],
      [
        [null, "a", null],
        ["a", null],
      ],
      [["a", null], [null]],
      [
        ["a", "b", "c"],
        ["a", "b"],
      ],
      [
        ["a", "b", "c"],
        ["b", "c"],
      ],
      [
        ["a", "b", "c"],
        ["a", "c"],
      ],
    ])("#%#: %p → %p", (oldList, newList) => {
      const base = completeObject({
        connection: entityFooConnection({ edges: oldList.map(keyToEdge) }),
      });
      const model = completeObject({
        connection: entityFooConnection({ edges: newList.map(keyToEdge) }),
      });

      const { data } = diffAndUpdate(base, model, testEnv());

      expect(data).toEqual(model);
      expect(data).not.toBe(model);
      expect(data).not.toBe(base);
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
      const { data } = diffAndUpdate(base, model, testEnv());

      expect(data).toEqual(model);
      expect(data).not.toBe(model);
      expect(data).not.toBe(base);

      for (const [dataIndex, baseIndexOrKey] of expectedLayout.entries()) {
        const value = data.connection.edges[dataIndex];
        if (typeof baseIndexOrKey === "number") {
          expect(value).toBe(base.connection.edges[baseIndexOrKey]);
        } else if (baseIndexOrKey === null) {
          expect(value).toBe(null);
        } else {
          expect(value).toEqual(keyToEdge(baseIndexOrKey));
        }
      }
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

      const { data } = diffAndUpdate(base, model, testEnv());

      expect(data).toEqual(model);
      expect(data).not.toBe(model);
      expect(data).not.toBe(base);

      for (const [dataIndex, baseIndexOrKey] of expectedLayout.entries()) {
        const value = data.connection.edges[dataIndex];
        if (typeof baseIndexOrKey === "number") {
          expect(value).toBe(base.connection.edges[baseIndexOrKey]);
        } else if (baseIndexOrKey === null) {
          expect(value).toBe(null);
        } else {
          expect(value).toEqual(keyToEdge(baseIndexOrKey));
        }
      }
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

      const { data } = diffAndUpdate(base, model, testEnv());

      expect(data).toEqual(model);
      expect(data).not.toBe(model);
      expect(data).not.toBe(base);

      for (const [dataIndex, baseIndexOrKey] of expectedLayout.entries()) {
        const value = data.connection.edges[dataIndex];
        if (typeof baseIndexOrKey === "number") {
          expect(value).toBe(base.connection.edges[baseIndexOrKey]);
        } else if (baseIndexOrKey === null) {
          expect(value).toBe(null);
        } else {
          expect(value).toEqual(keyToEdge(baseIndexOrKey));
        }
      }
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

      const { data } = diffAndUpdate(base, model, testEnv());

      expect(data).toEqual(model);
      expect(data).not.toBe(model);
      expect(data).not.toBe(base);

      for (const [dataIndex, baseIndexOrKey] of expectedLayout.entries()) {
        const value = data.connection.edges[dataIndex];
        if (typeof baseIndexOrKey === "number") {
          expect(value).toBe(base.connection.edges[baseIndexOrKey]);
        } else if (baseIndexOrKey === null) {
          expect(value).toBe(null);
        } else {
          expect(value).toEqual(keyToEdge(baseIndexOrKey));
        }
      }
    });
  });
});

describe("list kitchen-sink", () => {
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
    const { data } = diffAndUpdate(base, model);

    expect(data).toEqual(model);
    expect(data).not.toBe(model);
    expect(data).not.toBe(base);

    for (const [dataIndex, baseIndexOrKey] of expectedLayout.entries()) {
      const value = data.entityOrPlainObjectUnionList[dataIndex];
      if (typeof baseIndexOrKey === "number") {
        expect(value).toBe(base.entityOrPlainObjectUnionList[baseIndexOrKey]);
      } else if (baseIndexOrKey === null) {
        expect(value).toBe(null);
      } else {
        expect(value).toEqual(keyToEntity(baseIndexOrKey));
      }
    }
  });
});

describe("with missing fields", () => {
  test("ignores missing fields during update", () => {
    const base = completeObject();
    const model = objectWithMissingFields();

    const { data, updatedTree } = diffAndUpdate(base, model);

    expect(data).toBe(base);
    expect(updatedTree.incompleteChunks.size).toBe(0);
  });

  test("still updates other changed fields in presence of missing fields", () => {
    const base = completeObject({
      scalar: "foo",
      plainObject: plainObjectFoo({ foo: "foo" }),
    });
    const model = objectWithMissingFields({
      scalar: "changed",
      plainObject: plainObjectFoo({ foo: "changed" }),
    });
    const { data, updatedTree } = diffAndUpdate(base, model);

    expect(data).toEqual(
      completeObject({
        scalar: "changed",
        plainObject: plainObjectFoo({ foo: "changed" }),
      }),
    );
    expect(data).not.toBe(model);
    expect(data).not.toBe(base);
    expect(updatedTree.incompleteChunks.size).toBe(0);
  });

  test("fills missing fields", () => {
    const base = objectWithMissingFields();
    const model = completeObject();
    const { data, updatedTree } = diffAndUpdate(base, model);

    expect(data).toEqual(completeObject());
    expect(data).not.toBe(model);
    expect(data).not.toBe(base);
    expect(updatedTree.incompleteChunks.size).toBe(0);
  });
});

describe("with different selections", () => {
  test("updates entities", () => {
    const base = completeObject({
      entity: entityFoo({ foo: "foo" }),
    });
    const model = completeObject({
      entity: entityFoo({ foo: "changed" }),
    });
    const { difference } = diff(base, model);

    const otherTree: TestValue = [
      completeObject({
        entity: entityFoo({ fooAliased: "foo" }),
      }),
      gql`
        fragment OtherObject on CompleteObject {
          __typename
          entity {
            __typename
            id
            fooAliased: foo
          }
        }
      `,
    ];
    const { data } = update(otherTree, difference);

    expect(data.entity).toEqual(entityFoo({ fooAliased: "changed" }));
    expect(data).not.toBe(base);
    expect(data).not.toBe(model);
  });
});

describe("change reporting", () => {
  test("reports changed object fields", () => {
    const base = completeObject({
      scalar: "foo",
      plainObject: plainObjectFoo({ foo: "foo" }),
    });
    const model = completeObject({
      scalar: "changed",
      plainObject: plainObjectFoo({ foo: "changed" }),
    });
    const { changes } = diffAndUpdate(base, model);

    expect(changes.size).toEqual(2);

    const [[first, firstFields], [second, secondFields]] = changes.entries();
    expect(firstFields?.length).toEqual(1);
    expect(firstFields?.[0]?.name).toEqual("foo");
    expect(first.data).toBe(base.plainObject);

    expect(secondFields?.length).toEqual(1);
    expect(secondFields?.[0]?.name).toEqual("scalar");
    expect(second.data).toBe(base);
  });

  test("does not report parent as changed on nested chunk change", () => {
    const base = completeObject({
      plainObject: plainObjectFoo({ foo: "foo" }),
    });
    const model = completeObject({
      plainObject: plainObjectFoo({ foo: "changed" }),
    });
    const { changes } = diffAndUpdate(base, model);

    expect(changes.size).toEqual(1);

    const [[first, firstFields]] = changes.entries();
    expect(firstFields?.length).toEqual(1);
    expect(firstFields?.[0]?.name).toEqual("foo");
    expect(first.data).toBe(base.plainObject);
  });

  describe("reports changes in lists of scalars", () => {
    it.each([
      [["a"], []], // remove last item
      [["a", "b"], ["a"]], // remove from tail
      [["a", "b"], ["b"]], // remove from head
      [[], ["a"]], // add first item
      [["a"], ["b", "a"]], // prepend item
      [["a"], ["a", "b"]], // append item
      [
        ["a", "b"],
        ["a", "c"],
      ], // replace item
    ])("#%#: %p → %p", (baseList, modelList) => {
      const base = completeObject({ scalarList: baseList });
      const model = completeObject({ scalarList: modelList });

      const { changes } = diffAndUpdate(base, model);

      expect(changes.size).toEqual(1);

      // Expected to report as a change in parent object field
      const [[first, firstFields]] = changes.entries();
      expect(firstFields?.length).toEqual(1);
      expect(firstFields?.[0]?.name).toEqual("scalarList");
      expect(first.data).toBe(base);
    });
  });

  describe("reports changes in lists of plain objects", () => {
    it.each([
      [["a"], []], // remove last item
      [["a", "b"], ["a"]], // remove from tail
      [["a", "b"], ["b"]], // remove from head
      [[], ["a"]], // add first item
      [["a"], ["b", "a"]], // prepend item
      [["a"], ["a", "b"]], // append item
      // The following case actually mutates object fields, so list change should not be reported (see next test):
      // [["a", "b"], ["a", "c"]]
    ])("#%#: %p → %p", (a, b) => {
      const baseList = a.map((foo) => plainObjectFoo({ foo }));
      const modelList = b.map((foo) => plainObjectFoo({ foo }));

      const base = completeObject({ plainObjectList: baseList });
      const model = completeObject({ plainObjectList: modelList });

      const { changes } = diffAndUpdate(base, model);

      // Some of those list changes also mutate object fields, which we ignore in this test
      const listChunks = [...changes.keys()].filter((chunk) =>
        Array.isArray(chunk.data),
      );
      const [first] = listChunks;

      expect(listChunks.length).toEqual(1);
      expect(first.data).toBe(baseList);
    });
  });

  test("does not report change in list of plain objects when there are no layout changes", () => {
    const baseList = ["a", "b"].map((foo) => plainObjectFoo({ foo }));
    const modelList = ["a", "c"].map((foo) => plainObjectFoo({ foo }));

    const base = completeObject({ plainObjectList: baseList });
    const model = completeObject({ plainObjectList: modelList });

    const { changes } = diffAndUpdate(base, model);

    const listChunks = [...changes.keys()].filter((chunk) =>
      Array.isArray(chunk.data),
    );
    expect(listChunks.length).toEqual(0);
    expect(changes.size).toBeGreaterThan(0);
  });

  it.each([
    [["a"], []], // remove last item
    [["a", "b"], ["a"]], // remove from tail
    [["a", "b"], ["b"]], // remove from head
    [[], ["a"]], // add first item
    [["a"], ["b", "a"]], // prepend item
    [["a"], ["a", "b"]], // append item
    [
      ["a", "b"],
      ["a", "c"],
    ], // replace item
  ])("reports changes in entity lists", (oldList, newList) => {
    const base = completeObject({
      entityList: oldList.map(keyToEntity),
    });
    const model = completeObject({
      entityList: newList.map(keyToEntity),
    });
    const { changes } = diffAndUpdate(base, model);
    const [first] = changes.keys();

    expect(changes.size).toEqual(1);
    expect(first.data).toBe(base.entityList); // sanity-check
  });
});

describe("inconsistent state", () => {
  // Note: this can happen if previous operation update failed and operation result is now stale.
  //   It is still possible to update _some_ "nodes", but others may be in a permanent stale state.
  // TODO
  test.skip("marks null fields as stale", () => {
    const diffBase = completeObject({
      completeObject: completeObject({
        plainObject: plainObjectFoo({ foo: "foo" }),
      }),
    });
    const model = completeObject({
      completeObject: completeObject({
        plainObject: plainObjectFoo({ foo: "updated" }),
      }),
    });
    const { difference } = diff(diffBase, model);

    const updatedBase = completeObject({
      completeObject: completeObject({
        plainObject: null,
      }),
    });
    const { data } = update(updatedBase, difference);

    expect(data.plainObject).toEqual(null);
  });

  test("does not update missing values", () => {
    // Assuming it will trigger re-fetching anyway, given it already has missing field

    const diffBase = completeObject({
      completeObject: completeObject({
        plainObject: plainObjectFoo({ foo: "foo" }),
      }),
    });
    const model = completeObject({
      completeObject: completeObject({
        plainObject: plainObjectFoo({ foo: "updated" }),
      }),
    });
    const { difference } = diff(diffBase, model);

    const updatedBase = completeObject({
      completeObject: completeObject({
        plainObject: undefined,
      }),
    });
    const { data } = update(updatedBase, difference);

    expect(data).toBe(updatedBase);
  });
});

describe("completes updated objects", () => {
  test.todo("identifiable objects");
  test.todo("plain objects");
  test.todo("list items");
});

describe("ApolloCompat: orphan nodes", () => {
  test("should keep orphan nodes around", () => {
    const base = entityFoo({ id: "base" });
    const model = entityFoo({ id: "model" });

    const { updatedTree } = diffAndUpdate(
      completeObject({
        entity: base,
      }),
      completeObject({
        entity: model,
      }),
      { apolloCompat_keepOrphanNodes: true },
    );

    expect(updatedTree.nodes.get("base")?.length).toBe(1);
    expect(updatedTree.nodes.get("base")?.[0]?.data).toBe(base);
    expect(updatedTree.nodes.get("model")?.length).toBe(1);
    expect(updatedTree.nodes.get("model")?.[0]?.data).toBe(model);
    expect(updatedTree.result.data.entity).toBe(model);
  });

  test("should keep orphan nodes up to date", () => {
    const orphan = entityFoo({ id: "orphan", foo: "version1" });
    const updatedOrphan = entityFoo({ id: "orphan", foo: "version2" });

    const { updatedTree } = diffAndUpdate(
      completeObject({ entityList: [orphan] }),
      completeObject({ entityList: [] }),
    );
    const { updatedTree: updatedTree2 } = diffAndUpdate(
      updatedTree,
      completeObject({ entity: updatedOrphan }),
    );

    expect(updatedTree2.nodes.get("orphan")?.length).toBe(1);
    expect(updatedTree2.nodes.get("orphan")?.[0]?.data).toBe(updatedOrphan);
    expect(updatedTree.result.data.entityList).toEqual([]);
  });
});

type TestValue = [SourceObject, DocumentNode, VariableValues?];

function diffAndUpdate(
  base: SourceObject | TestValue | IndexedTree,
  model: SourceObject | TestValue,
  testEnv: Partial<ForestEnv> = {},
) {
  const { baseTree, modelTree, forest, env } = prepareDiffTrees(
    base,
    model,
    testEnv,
  );
  // Shield against side effects
  maybeDeepFreeze(baseTree.result);
  maybeDeepFreeze(modelTree.result);

  const difference = diffTree(forest, modelTree, env);
  const { updatedTree, changes } = updateTree(
    baseTree,
    difference.nodeDifference,
    env,
  );
  return {
    baseTree,
    difference,
    modelTree,
    updatedTree,
    changes,
    data: updatedTree.result.data as any,
  };
}

function prepareDiffTrees(
  base:
    | SourceObject
    | [SourceObject, DocumentNode, VariableValues?]
    | IndexedTree,
  model: SourceObject | [SourceObject, DocumentNode, VariableValues?],
  testEnv: Partial<DiffEnv & ForestEnv> = {},
) {
  const defaultOperation = isTree(base)
    ? base.operation
    : createTestOperation(completeObjectDoc);
  const env: DiffEnv & ForestEnv = {
    objectKey: (obj) => obj.id as string,
    ...(testEnv ?? {}),
  };
  const baseTree = isTree(base)
    ? base
    : Array.isArray(base)
    ? createTestTree(
        createTestOperation(base[1], base[2]),
        base[0],
        undefined,
        env,
      )
    : createTestTree(defaultOperation, base, undefined, env);

  const modelTree = Array.isArray(model)
    ? createTestTree(
        createTestOperation(model[1], model[2]),
        model[0],
        undefined,
        env,
      )
    : createTestTree(defaultOperation, model, undefined, env);

  const forest = createTestForest();
  addForestTree(forest, baseTree);

  return { env, baseTree, modelTree, forest };
}

function diff(
  base: SourceObject | TestValue,
  model: SourceObject | TestValue,
  testEnv: Partial<ForestEnv & DiffEnv> = {},
) {
  const { env, modelTree, baseTree, forest } = prepareDiffTrees(
    base,
    model,
    testEnv,
  );
  const difference = diffTree(forest, modelTree, env);
  return { difference, baseTree, modelTree, forest, env };
}

function update(
  base: SourceObject | TestValue,
  diff: GraphDifference,
  testEnv: Partial<ForestEnv> = {},
) {
  const defaultOperation = createTestOperation(completeObjectDoc);
  const env: ForestEnv = {
    objectKey: (obj) => obj.id as string,
    ...(testEnv ?? {}),
  };
  const baseTree = Array.isArray(base)
    ? createTestTree(
        createTestOperation(base[1], base[2]),
        base[0],
        undefined,
        env,
      )
    : createTestTree(defaultOperation, base, undefined, env);

  const { updatedTree, changes } = updateTree(
    baseTree,
    diff.nodeDifference,
    env,
  );
  return {
    baseTree,
    updatedTree,
    changes,
    data: updatedTree.result.data as any,
  };
}

function keyToEntity(keyOrOther: string | unknown) {
  return typeof keyOrOther === "string"
    ? entityFoo({ id: keyOrOther })
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

function isTree(value: any): value is IndexedTree {
  return Boolean(value["operation"] && value["result"] && value["nodes"]);
}
