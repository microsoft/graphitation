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

## Releasing alpha versions

1. Open the `graphitation-release` pipeline in Azure DevOps and run it from the branch you want to release from.
2. Turn on **Publish as prerelease from current branch**.
3. The pipeline will publish using `prerelease` npm dist-tag and use your selected branch as the beachball target branch automatically.
4. Every time you want to release a new prerelease version use `yarn change` and select `prerelease`. To avoid patching dependent packages set `dependentChangeType` to `none` manually in `.changes` files.
