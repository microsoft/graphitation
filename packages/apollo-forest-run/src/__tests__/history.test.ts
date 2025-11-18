import { ForestRun } from "../ForestRun";
import { gql } from "./helpers/descriptor";
import { OPERATION_HISTORY_SYMBOL } from "../descriptor/operation";

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
  });

  test("should capture list changes in history entries", () => {
    const cache = new ForestRun({
      historyConfig: {
        enableRichHistory,
        overwrittenHistorySize: 1,
      },
    });

    const writeTodos = (todos: unknown[]) => {
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

    writeTodos([
      createTodo("1", "Write tests"),
      createTodo("2", "Fix bug"),
      createTodo("3", "Ship product"),
    ]);

    writeTodos([
      createTodo("3", "Ship product"),
      createTodo("4", "Plan next sprint"),
      createTodo("1", "Write tests"),
    ]);

    const data: any = cache.read({
      query: TODO_QUERY,
      optimistic: true,
    });

    const history = data[OPERATION_HISTORY_SYMBOL];

    expect(history).toMatchSnapshot();
  });
});
