Apollo watch queries:

1. Create single large query composed of all fragments and use that to actually query the data.
2. Replace `useQuery` in root component with a `useQuery` that excludes fragments annotated with `@watchNode`.
3. Replace `useFragment` with `@watchNode` fragments with `useQuery` and Relay's refetchable `node` query.
   Then use an Apollo Client `Query.node` type-policy to read the already cached data
