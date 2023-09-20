export interface TodoData {
  id: number;
  description: string;
  isCompleted: boolean;
}

export class DB {
  private newId: number;
  private todos: TodoData[];

  constructor(todos: Omit<TodoData, "id">[]) {
    this.newId = 0;
    this.todos = [];
    todos.forEach((todo) => {
      this.addTodo(todo);
    });
  }

  public getTodos(): ReadonlyArray<Readonly<TodoData>> {
    return this.todos;
  }

  public getTodo(id: number) {
    return this.todos.find((todo) => todo.id === id);
  }

  public getTotalTodoCount(): number {
    return this.todos.length;
  }

  public getUncompletedTodoCount(): number {
    return this.todos.filter((todo) => !todo.isCompleted).length;
  }

  public setTodoStatus(id: number, isCompleted: boolean) {
    const todo = this.todos.find((t) => t.id === id)!;
    todo.isCompleted = isCompleted;
    return todo;
  }

  public addTodo(todoData: { description: string; isCompleted?: boolean }) {
    const todo: TodoData = {
      isCompleted: false,
      id: this.newId++,
      ...todoData,
    };
    this.todos.push(todo);
    return todo;
  }
}
