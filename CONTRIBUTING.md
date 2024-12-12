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

1. Add a branch which will be releasing alpha version to .azure-devops\graphitation-release.yml into `trigger`
2. Change `release` script in the root package json to `yarn beachball publish -t alpha`,
3. Modify package.json of the package you want to release to x.x.x-alpha.0
4. Every time you want to release a new version use `yarn change` and select `prelease`. To avoid patching of dependent packages set `dependentChangeType` to `none` manually in .changes directory
