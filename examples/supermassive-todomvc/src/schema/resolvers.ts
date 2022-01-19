import { v4 } from "uuid";
// import { Resolvers } from "@graphitation/supermassive";

interface Todo {
  id: string;
  text: string;
  isCompleted: boolean;
}

const ALL_TODOS_KEY = "SUPERMASSIVE_ALL_TODOS";

export class TodoStorage {
  localStorage: Storage;

  constructor(localStorage: Storage) {
    this.localStorage = localStorage;
  }

  getAllTodos(): Array<Todo> {
    const existingTodos = this.localStorage.getItem(ALL_TODOS_KEY);
    if (existingTodos) {
      return JSON.parse(existingTodos) as any as Array<Todo>;
    } else {
      return [];
    }
  }

  saveTodos(todos: Array<Todo>): void {
    this.localStorage.setItem(ALL_TODOS_KEY, JSON.stringify(todos));
  }

  createTodo(text: string): Todo {
    const todos = this.getAllTodos();
    const todo: Todo = {
      id: v4(),
      text,
      isCompleted: false,
    };
    todos.push(todo);
    this.saveTodos(todos);
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
      if (text) {
        todos[todoIndex].text = text;
      }
      if (isCompleted) {
        todos[todoIndex].isCompleted = isCompleted;
      }
      this.saveTodos(todos);
    }
    return todos[todoIndex];
  }

  deleteTodo(id: string): void {
    const todos = this.getAllTodos();
    const todoIndex = findIndex(todos, (otherTodo) => otherTodo.id === id);
    if (todoIndex !== -1) {
      todos.splice(todoIndex, 1);
      this.saveTodos(todos);
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
    emitTodos: {
      subscribe: async function* (
        _source: any,
        { limit }: { limit: number },
        context: { todoStorage: { getAllTodos: () => any } },
        _info: any
      ) {
        const allTodos = context.todoStorage.getAllTodos();
        const todosLimit = Math.min(limit, allTodos.length);
        for (let i = 0; i < todosLimit; i++) {
          yield { emitTodos: allTodos[i] };
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
