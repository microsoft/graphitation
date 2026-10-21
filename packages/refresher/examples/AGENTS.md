- An example's React integration (`federated-chat/lib/react.tsx`) is an explicit exception: it may use hooks, React state and refs.
- Do not use React hooks, React state, React refs outside the React integration. Keep data and writes application-owned; expose reads to Refresher through stores and store views.
  Product components may call the hooks the integration exposes (`useQuery`, `useData`, `useHandler`, `useActionEffect`), and nothing else: no `useContext`, `useState`, or custom contexts of their own. The integration owns its context; components reach the client and the runner only through its hooks, below its `DataProvider`.
- Fill what Refresher is missing inside the example's `lib/` folder, not in `src`, and list it in the example's README under "Gaps".
- Do not write tests for examples (unless the example is about writing tests for refresher)
