import { v4 } from "uuid";
import { subscribe as subscribeToEvents } from "event-iterator/lib/dom";
// import { Resolvers } from "@graphitation/supermassive";

interface Todo {
  id: string;
  text: string;
  isCompleted: boolean;
}

type StorageMutationEvent = {
  id: string;
  type: "create" | "update" | "delete";
};
type SerializedStorage = { todos: Array<Todo>; event: StorageMutationEvent };

const ALL_TODOS_KEY = "SUPERMASSIVE_ALL_TODOS";

export class TodoStorage {
  localStorage: Storage;

  constructor(localStorage: Storage) {
    this.localStorage = localStorage;
  }

  getAllTodos(): Array<Todo> {
    const existingTodos = this.localStorage.getItem(ALL_TODOS_KEY);
    if (existingTodos) {
      return (JSON.parse(existingTodos) as SerializedStorage).todos.sort(
        (a, b) => a.text.localeCompare(b.text)
      );
    } else {
      return [];
    }
  }

  getTodoById(id: string): Todo | null {
    return this.getAllTodos().find((todo) => todo.id === id) || null;
  }

  getLastEvent(): StorageMutationEvent | null {
    const existingTodos = this.localStorage.getItem(ALL_TODOS_KEY);
    if (existingTodos) {
      return (JSON.parse(existingTodos) as SerializedStorage).event;
    } else {
      return null;
    }
  }

  saveTodos(todos: Array<Todo>, event: StorageMutationEvent): void {
    const data: SerializedStorage = { todos, event };
    this.localStorage.setItem(ALL_TODOS_KEY, JSON.stringify(data));
  }

  createTodo(text: string): Todo {
    const todos = this.getAllTodos();
    const todo: Todo = {
      id: v4(),
      text,
      isCompleted: false,
    };
    todos.push(todo);
    this.saveTodos(todos, { id: todo.id, type: "create" });
    return todo;
  }

  updateTodo({
    id,
    text,
    isCompleted,
  }: {
    id: string;
    text?: string;
    isCompleted?: boolean;
  }): Todo | null {
    const todos = this.getAllTodos();
    const todoIndex = findIndex(todos, (otherTodo) => otherTodo.id === id);
    if (todoIndex !== -1) {
      if (text !== undefined) {
        todos[todoIndex].text = text;
      }
      if (isCompleted !== undefined) {
        todos[todoIndex].isCompleted = isCompleted;
      }
      this.saveTodos(todos, { id, type: "update" });
    }
    return todos[todoIndex];
  }

  deleteTodo(id: string): void {
    const todos = this.getAllTodos();
    const todoIndex = findIndex(todos, (otherTodo) => otherTodo.id === id);
    if (todoIndex !== -1) {
      todos.splice(todoIndex, 1);
      this.saveTodos(todos, { id, type: "delete" });
    }
  }
}

export type Context = {
  todoStorage: TodoStorage;
};

export const resolvers: any = {
  Query: {
    allTodos(
      _source: any,
      _args: any,
      context: { todoStorage: { getAllTodos: () => any } },
      _info: any
    ) {
      return context.todoStorage.getAllTodos();
    },
  },
  Subscription: {
    todoUpdated: {
      subscribe: async function* (
        _source: unknown,
        _args: unknown,
        context: {
          todoStorage: TodoStorage;
        },
        _info: unknown
      ) {
        for await (const e of subscribeToEvents.call(window, "storage")) {
          const event = e as StorageEvent;
          if (event.storageArea === window.localStorage) {
            const lastEvent = context.todoStorage.getLastEvent();
            if (lastEvent && lastEvent.type === "update") {
              const todo = context.todoStorage.getTodoById(lastEvent.id);
              yield { todoUpdated: todo };
            }
          }
        }
      },
    },
    todoCreated: {
      subscribe: async function* (
        _source: unknown,
        _args: unknown,
        context: {
          todoStorage: TodoStorage;
        },
        _info: unknown
      ) {
        for await (const e of subscribeToEvents.call(window, "storage")) {
          const event = e as StorageEvent;
          if (event.storageArea === window.localStorage) {
            const lastEvent = context.todoStorage.getLastEvent();
            if (lastEvent && lastEvent.type === "create") {
              const todo = context.todoStorage.getTodoById(lastEvent.id);
              yield { todoCreated: todo };
            }
          }
        }
      },
    },
  },
  Mutation: {
    createTodo(
      _source: any,
      { input }: any,
      context: { todoStorage: { createTodo: (arg0: any) => any } },
      _info: any
    ) {
      const result = context.todoStorage.createTodo(input.text);
      if (result != null) {
        return {
          __typename: "CreateTodoSuccess",
          todo: result,
        };
      } else {
        return {
          __typename: "CreateTodoFailure",
          reason: "haha",
        };
      }
    },
    updateTodoText(
      _source: any,
      { input }: any,
      context: {
        todoStorage: { updateTodo: (arg0: { id: any; text: any }) => any };
      },
      _info: any
    ) {
      const result = context.todoStorage.updateTodo({
        id: input.id,
        text: input.text,
      });
      if (result != null) {
        return {
          __typename: "UpdateTodoTextSuccess",
          todo: result,
        };
      } else {
        return {
          __typename: "UpdateTodoTextFailure",
          reason: "haha",
        };
      }
    },
    setTodoCompleted(
      _source: any,
      { input }: any,
      context: {
        todoStorage: {
          updateTodo: (arg0: { id: any; isCompleted: any }) => any;
        };
      },
      _info: any
    ) {
      const result = context.todoStorage.updateTodo({
        id: input.id,
        isCompleted: input.isCompleted,
      });
      if (result != null) {
        return {
          __typename: "SetTodoCompletedSuccess",
          todo: result,
        };
      } else {
        return {
          __typename: "SetTodoCompletedFailure",
          reason: "haha",
        };
      }
    },
  },
};

function findIndex<A>(arr: Array<A>, finder: (element: A) => Boolean): number {
  const result = [];
  for (let i = 0; i < arr.length; i++) {
    if (finder(arr[i])) {
      return i;
    }
  }
  return -1;
}
