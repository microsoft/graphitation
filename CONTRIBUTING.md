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

## Releasing packages

Graphitation releases are managed by beachball and the Azure DevOps pipeline
[microsoft.graphitation](https://dev.azure.com/DomoreexpGithub/Github_Pipelines/_build?definitionId=8).

1. Add change files with `yarn change`. Change files determine which packages are released and what version bump each package receives.
2. Run the release pipeline from `main` for a stable release. The pipeline publishes the changed packages to the private ADO npm feed and to npmjs through ESRP, then beachball bumps package versions, updates changelogs, removes consumed change files, and pushes the release commit.
3. Run the release pipeline from a non-`main` branch to publish canaries only to the private ADO npm feed. Beachball's `canary` command publishes prerelease versions such as `0.21.1-canary.0` with the `canary` dist-tag and does not modify the branch.

Notes:

- Release jobs must stay network-isolated and cannot make arbitrary network calls.
- The public npm release must go through ESRP; direct npm-token publishing is not used.
- Stable packages are published to both npmjs and the private internal ADO feed. Canary packages are published only to the private ADO feed.
- The bump commit message includes `[skip ci]` to avoid triggering another release run.
- See [graphitation-release.yml](.azure-devops/graphitation-release.yml) for the exact job graph.
