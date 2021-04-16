# Contributing

## Development setup

This repo uses `yarn` for package management:

```
git clone https://github.com/microsoft/graphitation.git
yarn
```

## Inner loop

For the innerloop experience, we take advantage of TypeScript watch mode:

```
cd packages/somepackage
yarn start
```

Or, use the `yarn workspace` feature:

```
yarn workspace somepackage start
```

## Build (no typechecking, incremental)

This repo uses [`lage`](https://microsoft.github.io/lage) to achieve incremental builds:

```
yarn build
```

## Generating Types

Type (d.ts) generation is done separately from build since 

```
yarn build
```

## Test

```
yarn test
```

## Lint

```
yarn lint
```
