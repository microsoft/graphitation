import type { CompositeListLayoutChange } from "../diff/types";

import { ForestRun } from "../ForestRun";
import { gql } from "./helpers/descriptor";
import { OPERATION_HISTORY_SYMBOL } from "../descriptor/operation";

import * as ItemChangeKind from "../diff/itemChangeKind";

jest.useFakeTimers().setSystemTime(new Date("2020-01-01"));

const USER_QUERY = gql`
  query GetUserHistory {
    user {
      __typename
      id
      name
    }
  }
`;

const TODO_QUERY = gql`
  query GetTodoHistory {
    user {
      __typename
      id
      todos {
        __typename
        id
        text
      }
    }
  }
`;

const TODO_QUERY_WITH_COMPLETED = gql`
  query GetTodoHistoryWithCompleted {
    user {
      __typename
      id
      todos {
        __typename
        id
        text
        completed
      }
    }
  }
`;

const createUser = (name: string) => ({
  __typename: "User" as const,
  id: "1",
  name,
});

const createTodo = (id: string, text: string) => ({
  __typename: "Todo" as const,
  id,
  text,
});

describe("History size handling", () => {
  test("should not store history when partition is not present and overwrittenHistorySize is undefined", () => {
    const cache = new ForestRun();

    cache.write({
      query: USER_QUERY,
      result: { user: createUser("Alice v1") },
    });
    cache.write({
      query: USER_QUERY,
      result: { user: createUser("Alice v2") },
    });
    const data: any = cache.read({
      query: USER_QUERY,
      optimistic: true,
    });
    const historyEntry = data[OPERATION_HISTORY_SYMBOL];

    expect(historyEntry).toBeUndefined();
  });

  test("should store history up to overwrittenHistorySize when partition is not present", () => {
    const cache = new ForestRun({
      historyConfig: {
        overwrittenHistorySize: 2,
      },
    });

    cache.write({
      query: USER_QUERY,
      result: { user: createUser("Alice v1") },
    });
    cache.write({
      query: USER_QUERY,
      result: { user: createUser("Alice v2") },
    });
    cache.write({
      query: USER_QUERY,
      result: { user: createUser("Alice v3") },
    });
    const data: any = cache.read({
      query: USER_QUERY,
      optimistic: true,
    });
    const historyEntry = data[OPERATION_HISTORY_SYMBOL];

    expect(historyEntry.history.length).toBe(2);
  });

  test("should store history up to partition-specified history size", () => {
    const cache = new ForestRun({
      historyConfig: {
        partitions: {
          default: 1,
        },
        // @ts-expect-error We allow only keys present in partitions
        partitionKey() {
          // eslint-disable-next-line
          if (false) {
            return "nonexistent";
          }
          return "default";
        },
      },
    });

    cache.write({
      query: USER_QUERY,
      result: { user: createUser("Alice v1") },
    });
    cache.write({
      query: USER_QUERY,
      result: { user: createUser("Alice v2") },
    });
    cache.write({
      query: USER_QUERY,
      result: { user: createUser("Alice v3") },
    });
    const data: any = cache.read({
      query: USER_QUERY,
      optimistic: true,
    });
    const historyEntry = data[OPERATION_HISTORY_SYMBOL];

    expect(historyEntry.history.length).toBe(1);
    expect(historyEntry.totalEntries).toBe(2);
  });

  test("should store history up to overwrittenHistorySize when both partition and overwrittenHistorySize are present", () => {
    const cache = new ForestRun({
      historyConfig: {
        overwrittenHistorySize: 2,
        partitions: {
          default: 1,
        },
        partitionKey() {
          return "default";
        },
      },
    });

    cache.write({
      query: USER_QUERY,
      result: { user: createUser("Alice v1") },
    });
    cache.write({
      query: USER_QUERY,
      result: { user: createUser("Alice v2") },
    });
    cache.write({
      query: USER_QUERY,
      result: { user: createUser("Alice v3") },
    });
    const data: any = cache.read({
      query: USER_QUERY,
      optimistic: true,
    });
    const historyEntry = data[OPERATION_HISTORY_SYMBOL];

    expect(historyEntry.history.length).toBe(2);
    expect(historyEntry.totalEntries).toBe(2);
  });
});

describe.each([true, false])("enableRichHistory: %p", (enableRichHistory) => {
  const writeTodos = (todos: unknown[], cache: ForestRun) => {
    cache.write({
      query: TODO_QUERY,
      result: {
        user: {
          __typename: "User",
          id: "1",
          todos,
        },
      },
    });
  };
  test("should capture value changes in history entries", () => {
    const cache = new ForestRun({
      historyConfig: {
        enableRichHistory,
        overwrittenHistorySize: 1,
      },
    });

    cache.write({
      query: USER_QUERY,
      result: { user: createUser("Alice v1") },
    });
    cache.write({
      query: USER_QUERY,
      result: { user: createUser("Alice v2") },
    });
    const data: any = cache.read({
      query: USER_QUERY,
      optimistic: true,
    });
    const history = data[OPERATION_HISTORY_SYMBOL];

    expect(history).toMatchSnapshot();
    expect(history.historyWithoutData).toMatchSnapshot();
  });

  test("should capture list changes in history entries", () => {
    const cache = new ForestRun({
      historyConfig: {
        enableRichHistory,
        overwrittenHistorySize: 1,
      },
    });

    writeTodos(
      [
        createTodo("1", "Write tests"),
        createTodo("2", "Fix bug"),
        createTodo("3", "Ship product"),
      ],
      cache,
    );

    writeTodos(
      [
        createTodo("3", "Ship product"),
        createTodo("4", "Plan next sprint"),
        createTodo("1", "Write tests"),
      ],
      cache,
    );

    const data: any = cache.read({
      query: TODO_QUERY,
      optimistic: true,
    });

    const history = data[OPERATION_HISTORY_SYMBOL];

    expect(history).toMatchSnapshot();
    expect(history.historyWithoutData).toMatchSnapshot();
  });

  test("should capture optimistic updates in history entries", () => {
    const cache = new ForestRun({
      historyConfig: {
        enableRichHistory,
        overwrittenHistorySize: 2,
      },
    });
    const historyEntries: any[] = [];
    const historyWithoutData: any[] = [];
    cache.watch({
      query: USER_QUERY,
      optimistic: true,
      callback: (data) => {
        const history = data.result[OPERATION_HISTORY_SYMBOL];
        if (history) {
          historyEntries.push(history);
          historyWithoutData.push(history.historyWithoutData);
        }
      },
    });
    cache.write({
      query: USER_QUERY,
      result: { user: createUser("Alice") },
    });

    cache.recordOptimisticTransaction(() => {
      cache.writeQuery({
        query: USER_QUERY,
        data: { user: createUser("Alice (optimistic)") },
      });
    }, "test-optimistic");

    cache.write({
      query: USER_QUERY,
      result: { user: createUser("Alice v2") },
    });

    expect(historyEntries).toMatchSnapshot();
    expect(historyWithoutData).toMatchSnapshot();
  });

  test("should capture missing fields in history entries", () => {
    const cache = new ForestRun({
      historyConfig: {
        enableRichHistory,
        overwrittenHistorySize: 1,
      },
    });

    const historyEntries: any[] = [];
    const historyWithoutData: any[] = [];

    cache.watch({
      query: TODO_QUERY_WITH_COMPLETED,
      optimistic: true,
      callback: (data) => {
        const history = data.result[OPERATION_HISTORY_SYMBOL];
        if (history) {
          historyEntries.push(history);
          historyWithoutData.push(history.historyWithoutData);
        }
      },
    });

    writeTodos([createTodo("1", "Write tests")], cache);

    writeTodos(
      [
        createTodo("1", "Write tests"),
        {
          id: "5",
        }, // missing text field
      ],
      cache,
    );

    expect(historyEntries).toMatchSnapshot();
    expect(historyWithoutData).toMatchSnapshot();
  });

  test("should capture optimistic array changes in history entries", () => {
    const cache = new ForestRun({
      historyConfig: {
        enableRichHistory,
        overwrittenHistorySize: 2,
      },
    });
    const historyEntries: any[] = [];
    const historyWithoutData: any[] = [];
    cache.watch({
      query: TODO_QUERY,
      optimistic: true,
      callback: (data) => {
        const history = data.result[OPERATION_HISTORY_SYMBOL];
        if (history) {
          historyEntries.push(history);
          historyWithoutData.push(history.historyWithoutData);
        }
      },
    });
    const newTodos = [
      createTodo("3", "New task"),
      createTodo("1", "Write tests"),
      createTodo("4", "Another new task"),
    ];

    writeTodos(
      [createTodo("1", "Write tests"), createTodo("2", "Fix bug")],
      cache,
    );

    cache.recordOptimisticTransaction(() => {
      cache.writeQuery({
        query: TODO_QUERY,
        data: {
          user: {
            __typename: "User",
            id: "1",
            todos: newTodos,
          },
        },
      });
    }, "test-optimistic-array-add");

    writeTodos(newTodos, cache);
    const optimisticEntry = historyEntries[0].history[0];

    expect(optimisticEntry.kind).toBe("Optimistic");
    expect(optimisticEntry.changes[0].currentLength).toBe(3);
    expect(optimisticEntry.changes[0].previousLength).toBe(2);

    const deletedItems = [];
    const addedItems = [];
    const movedItems = [];

    optimisticEntry.changes[0].itemChanges.forEach(
      (itemChange: CompositeListLayoutChange) => {
        switch (itemChange.kind) {
          case ItemChangeKind.ItemRemove:
            deletedItems.push(itemChange);
            break;
          case ItemChangeKind.ItemAdd:
            addedItems.push(itemChange);
            break;
          case ItemChangeKind.ItemIndexChange:
            movedItems.push(itemChange);
            break;
        }
      },
    );

    expect(deletedItems.length).toBe(1);
    expect(addedItems.length).toBe(2);
    expect(movedItems.length).toBe(1);

    expect(historyEntries).toMatchSnapshot();
    expect(historyWithoutData).toMatchSnapshot();
  });
});

describe("History getter", () => {
  test("should call getter for history only when history is accessed", () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const historyModule = require("../values/history");
    let getterCallCount = 0;

    const appendHistoryToDataSpy = jest
      .spyOn(historyModule, "appendHistoryToData")
      .mockImplementation((tree: any) => {
        Object.defineProperty(tree.result.data, OPERATION_HISTORY_SYMBOL, {
          get() {
            getterCallCount++;
          },
        });
      });

    const cache = new ForestRun({
      historyConfig: {
        overwrittenHistorySize: 1,
      },
    });

    cache.write({
      query: USER_QUERY,
      result: { user: createUser("Alice v1") },
    });
    cache.write({
      query: USER_QUERY,
      result: { user: createUser("Alice v2") },
    });

    const data: any = cache.read({
      query: USER_QUERY,
      optimistic: true,
    });
    expect(appendHistoryToDataSpy).toHaveBeenCalledTimes(1);
    expect(getterCallCount).toBe(0);

    const _history = data[OPERATION_HISTORY_SYMBOL];
    expect(getterCallCount).toBe(1);

    appendHistoryToDataSpy.mockRestore();
  });
});
