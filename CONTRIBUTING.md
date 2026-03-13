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

Generraly you need to only run pipeline [microsoft.graphitation](https://dev.azure.com/DomoreexpGithub/Github_Pipelines/_build?definitionId=8) and that is all.

Here described detailed steps of the release process:

1. Make sure you have generated change files for your changes using `yarn change` command.
1. In Azure DevOps run pipeline [microsoft.graphitation](https://dev.azure.com/DomoreexpGithub/Github_Pipelines/_build?definitionId=8)
1. Pipeline automatically adds the `alpha` tag and prefix to the version.
1. The package will be published to npm with the `alpha` tag, so you can install it using `npm i @graphitation/PACKAGE@VERSION-alpha.XX`
1. Bot push the bump commit to the branch.

The core logic is `-b "$releaseBranch" -t alpha --prerelease-prefix alpha` flags for beachball publish command which are added in the [graphitation-release.yml](.azure-devops/graphitation-release.yml#L66) pipeline.



