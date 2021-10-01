# Tests

From a browser console.

### Update Todo.description, used by the Todo component (a leaf component)

```js
$client.cache.modify({
  id: "Todo:Todo:0",
  fields: { description: () => "Chill" },
});
```

### Update TodosConnection.uncompletedCount, used by the TodoListFooter component (a leaf component)

```js
$client.cache.modify({
  id: "TodosConnection:TodosConnection:singleton",
  fields: { uncompletedCount: () => 42 },
});
```

### Update TodosConnection.totalCount, used by the App component (a parent component)

```js
$client.cache.modify({
  id: "TodosConnection:TodosConnection:singleton",
  fields: { totalCount: () => 42 },
});
```

### Completing a todo

- The todo item is first rendered with the existing state, then twice with the new state
- There should not be a reason to render TodoList
- There should not be a reason to render TodoListFooter
