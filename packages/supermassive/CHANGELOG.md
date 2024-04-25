# Change Log - @graphitation/supermassive

This log was last generated on Thu, 07 Mar 2024 13:08:30 GMT and should not be manually modified.

<!-- Start content -->

## 3.5.0

Thu, 07 Mar 2024 13:08:30 GMT

### Minor changes

- Execution hooks context (sergeystoyan@microsoft.com)

## 3.4.1

Mon, 15 Jan 2024 17:31:26 GMT

### Patches

- Properly decode boolean in schema (mark@thedutchies.com)

## 3.4.0

Wed, 10 Jan 2024 12:26:58 GMT

### Minor changes

- Revert new executor and fix errors again (mnovikov@microsoft.com)

## 3.3.0

Tue, 09 Jan 2024 09:30:02 GMT

### Minor changes

- Moved to newer stream/defer implementation (mnovikov@microsoft.com)

## 3.2.7

Tue, 12 Dec 2023 17:37:29 GMT

### Patches

- Fix type assertion for isTotalExecutionResult (mark@thedutchies.com)

## 3.2.6

Tue, 12 Dec 2023 13:48:37 GMT

### Patches

- Add invariant as a dependency (mark@thedutchies.com)

## 3.2.4

Tue, 07 Nov 2023 14:42:59 GMT

### Patches

- Fix unintentional breaking change in supermassive v3 (vladimir.razuvaev@gmail.com)

## 3.2.0

Thu, 28 Sep 2023 12:04:15 GMT

### Minor changes

- Add more utility functtions, fix decode locations (mnovikov@microsoft.com)

## 3.1.0

Wed, 27 Sep 2023 08:50:33 GMT

### Minor changes

- Add supermassive v3 annotations (mnovikov@microsoft.com)

## 3.0.1

Thu, 21 Sep 2023 06:28:45 GMT

### Patches

- Add exports entry for types to package.json (sverre.johansen@gmail.com)

## 3.0.0

Fri, 15 Sep 2023 16:06:32 GMT

### Major changes

- - feat: execution with compact schema fragments
- feat: schema fragment loading on demand
- feat: new document annotation strategy
- feat: experimental `@defer` and `@stream` support
- (vladimir.razuvaev@gmail.com)

## 3.0.0-alpha.9

Fri, 15 Sep 2023 00:43:00 GMT

### Changes

- graphql15 compatibility (vladimir.razuvaev@gmail.com)

## 3.0.0-alpha.8

Thu, 14 Sep 2023 19:05:33 GMT

### Changes

- change signature of executeWithSchema and subscribeWithSchema functions (vladimir.razuvaev@gmail.com)

## 3.0.0-alpha.7

Tue, 12 Sep 2023 23:58:31 GMT

### Changes

- refactor: replace PartialSchema class with ES module functions (vladimir.razuvaev@gmail.com)

## 3.0.0-alpha.6

Mon, 11 Sep 2023 19:24:32 GMT

### Changes

- fix mergeResolvers + more tests (vladimir.razuvaev@gmail.com)

## 3.0.0-alpha.5

Mon, 11 Sep 2023 12:06:07 GMT

### Changes

- switch to 1-indexed ids for spec type references (vladimir.razuvaev@gmail.com)

## 3.0.0-alpha.4

Sun, 10 Sep 2023 20:58:53 GMT

### Changes

- Schema fragment loader (vladimir.razuvaev@gmail.com)

## 3.0.0-alpha.3

Tue, 29 Aug 2023 15:06:36 GMT

### Changes

- New type annotation strategy (vladimir.razuvaev@gmail.com)

## 3.0.0-alpha.1

Tue, 27 Jun 2023 11:47:30 GMT

### Changes

- Supermassive v3 alpha - defer and stream stuff (mnovikov@microsoft.com)

## 2.6.0

Tue, 20 Jun 2023 11:38:47 GMT

### Minor changes

- Bump TS version in dev, move TS to peerDep (mnovikov@microsoft.com)

## 2.5.0

Mon, 19 Jun 2023 12:22:22 GMT

### Minor changes

- Separate ast annotator from supermassive (mnovikov@microsoft.com)

## 2.4.8

Mon, 12 Jun 2023 12:50:51 GMT

### Patches

- fix: use 'isObjectLike' in mergeResolvers due to failure when resolvers entry is esModule (sergeystoyan@microsoft.com)

## 2.4.7

Wed, 07 Jun 2023 08:48:18 GMT

### Patches

- Fix type export (mnovikov@microsoft.com)

## 2.4.6

Tue, 30 May 2023 15:52:16 GMT

### Patches

- Fix supermassive not supporting unpassed default arguments (mnovikov@microsoft.com)

## 2.4.2

Tue, 02 May 2023 10:22:49 GMT

### Patches

- [SUPERMASSIVE] fix invalid behavior in execution hooks error handling (sergeystoyan@microsoft.com)

## 2.4.0

Tue, 04 Apr 2023 10:29:16 GMT

### Minor changes

- Make execution argument `schemaResolvers` optional (vladimir.razuvaev@gmail.com)

## 2.3.0

Thu, 30 Mar 2023 08:30:21 GMT

### Minor changes

- [SUPERMASSIVE] Initial execution hooks implementation (sergeystoyan@microsoft.com)

## 2.1.0

Wed, 01 Mar 2023 10:48:32 GMT

### Minor changes

- New CLI (mnovikov@microsoft.com)

## 2.0.0

Mon, 21 Nov 2022 14:12:11 GMT

### Major changes

- Supermassive split into multiple packages (jakubvejr@microsoft.com)

## 1.1.7

Thu, 27 Oct 2022 12:54:10 GMT

### Patches

- contextPath relative to CWD and resolvers return readonly array (jakubvejr@microsoft.com)

## 1.1.6

Tue, 25 Oct 2022 10:26:19 GMT

### Patches

- Better error message (mnovikov@microsoft.com)

## 1.1.5

Mon, 24 Oct 2022 14:54:38 GMT

### Patches

- Codegen - subscription type fix, type fields are readonly and contextPath is relative to inputFile (jakubvejr@microsoft.com)

## 1.1.4

Mon, 17 Oct 2022 11:49:33 GMT

### Patches

- codegen: HOTFIX context folder mjs (jakubvejr@microsoft.com)

## 1.1.3

Fri, 14 Oct 2022 15:01:42 GMT

### Patches

- Hotfix: codegen imports fixed (jakubvejr@microsoft.com)

## 1.1.2

Wed, 12 Oct 2022 13:52:36 GMT

### Patches

- Hotfix: codegen subscription fixed (jakubvejr@microsoft.com)

## 1.1.1

Wed, 05 Oct 2022 16:48:48 GMT

### Patches

- Hotfix: typescript codegen fixes (models and models file path) (jakubvejr@microsoft.com)

## 1.1.0

Fri, 30 Sep 2022 08:56:18 GMT

### Minor changes

- Version bump (jakubvejr@microsoft.com)

## 1.0.0

Wed, 20 Jul 2022 16:31:59 GMT

### Major changes

- extractImplicitTypesToTypescript exported separately from supermassive (jakubvejr@microsoft.com)

## 0.8.5

Fri, 24 Jun 2022 11:59:47 GMT

### Patches

- Hotfix: re-export extractImplicitTypesToTypescript (jakubvejr@microsoft.com)

## 0.8.4

Thu, 23 Jun 2022 14:40:50 GMT

### Patches

- Schem extraction function exported (jakubvejr@microsoft.com)

## 0.8.3

Tue, 03 May 2022 17:45:10 GMT

### Patches

- Expose TypeScript type FunctionFieldResolver (vladimir.razuvaev@gmail.com)

## 0.8.2

Fri, 01 Apr 2022 16:00:03 GMT

### Patches

- Pin TS dependency (eloy.de.enige@gmail.com)

## 0.8.0

Thu, 10 Feb 2022 13:09:46 GMT

### Minor changes

- Resolvers merge is not required before using executeWithoutSchema (jakubvejr@microsoft.com)

## 0.7.2

Mon, 07 Feb 2022 09:13:38 GMT

### Patches

- tests use extracted resolvers from typescript file (jakubvejr@microsoft.com)

## 0.7.1

Fri, 04 Feb 2022 11:53:40 GMT

### Patches

- ensureValidRuntimeType error messages modified (jakubvejr@microsoft.com)

## 0.7.0

Thu, 03 Feb 2022 09:30:26 GMT

### Minor changes

- check whether a fragment is applicable to the given type (jakubvejr@microsoft.com)

## 0.6.3

Wed, 26 Jan 2022 09:11:30 GMT

### Patches

- getArgumentValues fix (jakubvejr@microsoft.com)

## 0.6.1

Mon, 24 Jan 2022 13:40:52 GMT

### Patches

- Fix Webpack 4 compat (mnovikov@microsoft.com)

## 0.6.0

Mon, 24 Jan 2022 11:18:59 GMT

### Minor changes

- Directives implemented (jakubvejr@microsoft.com)

## 0.5.2

Wed, 19 Jan 2022 13:39:52 GMT

### Patches

- Export AST types (jakubvejr@microsoft.com)

## 0.5.1

Tue, 18 Jan 2022 12:29:14 GMT

### Patches

- Reexported type fixed (jakubvejr@microsoft.com)

## 0.5.0

Tue, 18 Jan 2022 09:59:51 GMT

### Minor changes

- Added support for subscribe operation (jakubvejr@microsoft.com)

## 0.4.5

Fri, 14 Jan 2022 11:15:34 GMT

### Patches

- Make sideffects false actually work (mnovikov@microsoft.com)

## 0.4.4

Fri, 14 Jan 2022 10:12:20 GMT

### Patches

- Add side-effects false to all production packages for webpack opt (mnovikov@microsoft.com)

## 0.4.3

Mon, 10 Jan 2022 12:12:59 GMT

### Patches

- Unpin typescript dependency (vladimir.razuvaev@gmail.com)

## 0.4.2

Thu, 23 Dec 2021 12:10:32 GMT

### Patches

- Fix require in supermassive cli (mnovikov@microsoft.com)

## 0.4.1

Thu, 23 Dec 2021 11:32:16 GMT

### Patches

- Add graphql-js notice (mnovikov@microsoft.com)

## 0.4.0

Thu, 23 Dec 2021 11:31:14 GMT

### Minor changes

- Added proper mjs builds (bump for main release) (mnovikov@microsoft.com)

## 0.3.0

Tue, 14 Dec 2021 10:13:54 GMT

### Minor changes

- Support ESM in distro packages (mnovikov@microsoft.com)

## 0.2.0

Fri, 26 Nov 2021 15:43:37 GMT

### Minor changes

- Updated supermassive to be more suitable for usage (mnovikov@microsoft.com)

## 0.1.3

Tue, 26 Oct 2021 21:09:29 GMT

### Patches

- Bump @graphitation/graphql-js-tag to v0.5.5 (modevold@microsoft.com)

## 0.1.2

Tue, 26 Oct 2021 12:46:12 GMT

### Patches

- Align graphql dependency to version ^15.0.0 across packages (modevold@microsoft.com)

## 0.1.1

Mon, 04 Oct 2021 13:48:04 GMT

### Patches

- Bump @graphitation/graphql-js-tag to v0.5.4 (eloy.de.enige@gmail.com)
