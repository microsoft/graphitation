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

## Releasing versions including prerelease versions

1. Open the `graphitation-release` pipeline in Azure DevOps and run it from the branch you want to release from.
1. If the branch is `main`, packages are published with the default npm dist-tag (`latest`).
1. If the branch is not `main`, packages are published with the `alpha` npm dist-tag automatically.
