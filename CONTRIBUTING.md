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

## Releasing canary versions

1. Generate change files: `yarn change`
2. Run pipeline [microsoft.graphitation](https://dev.azure.com/DomoreexpGithub/Github_Pipelines/_build?definitionId=8) from your branch
3. Pipeline uses `beachball canary` to publish versions like `0.21.1-canary.0` with the `canary` dist-tag
4. Install via `npm i @graphitation/PACKAGE@canary`

Notes:

- Change files are required — they determine _which_ packages to publish and the change type _is_ respected for the base bump (e.g. `minor` on `0.21.0` → `0.22.0`). Canary then adds an extra prerelease patch on top, so the final version is `0.22.1-canary.0`.
- Canary versions auto-increment by checking the npm registry, so repeated runs are safe.
- See [graphitation-release.yml](.azure-devops/graphitation-release.yml) for details.
