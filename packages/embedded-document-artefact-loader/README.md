# @graphitation/embedded-document-artefact-loader

This is a simple set of webpack/jest loaders that will replace embedded GraphQL
documents with an import of an external compiled artefact file. It is meant to
remain agnostic of a specific AST form, so it can work with pipelines that use
babel, tsc, esbuild, swc, etc.
