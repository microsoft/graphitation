# Change Log - @graphitation/ts-codegen

<!-- This log was last generated on Mon, 30 Jun 2025 10:45:07 GMT and should not be manually modified. -->

<!-- Start content -->

## 5.2.2

Mon, 30 Jun 2025 10:45:07 GMT

### Patches

- Context directive accepts enum values in namespaces (77059398+vejrj@users.noreply.github.com)

## 5.2.1

Fri, 27 Jun 2025 11:21:36 GMT

### Patches

- Empty group allowed to enable group which will apply just baseContext (77059398+vejrj@users.noreply.github.com)

## 5.2.0

Thu, 19 Jun 2025 11:34:51 GMT

### Minor changes

- Codegen support resolver context conditionality and creating groups in input file (77059398+vejrj@users.noreply.github.com)

## 5.1.2

Thu, 05 Jun 2025 08:39:11 GMT

### Patches

- ts-codegen resolver context types will be defined explicitly in the input file (77059398+vejrj@users.noreply.github.com)

## 5.1.1

Tue, 03 Jun 2025 11:06:26 GMT

### Patches

- [HOTFIX] resolver context types generation fixed (77059398+vejrj@users.noreply.github.com)

## 5.1.0

Mon, 02 Jun 2025 12:26:31 GMT

### Minor changes

- Resolver context subtypes added (77059398+vejrj@users.noreply.github.com)

## 5.0.0

Thu, 29 May 2025 15:22:30 GMT

### Major changes

- feat(ts-codegen): use IterableOrAsyncIterable for return type of list field resolvers (dsamsonov@microsoft.com)

## 4.0.0

Tue, 08 Apr 2025 15:39:00 GMT

### Major changes

- emit input types as a part of models.interface.ts (dsamsonov@microsoft.com)

## 3.2.0

Wed, 02 Apr 2025 11:43:32 GMT

### Minor changes

- Changed build target from ES6 to ES2018 (vrazuvaev@microsoft.com_msteamsmdb)

## 3.1.0

Mon, 24 Mar 2025 11:24:10 GMT

### Minor changes

- feat(ts-codegen): do not emit empty models.interface.ts (dsamsonov@microsoft.com)

## 3.0.0

Wed, 19 Feb 2025 11:31:28 GMT

### Major changes

- feat(ts-codegen): translate @import into namespace imports (dsamsonov@microsoft.com)

## 2.15.1

Tue, 18 Feb 2025 09:21:15 GMT

### Patches

- feat(ts-codegen): do not emit empty resolvers.interface.ts (dsamsonov@microsoft.com)

## 2.15.0

Wed, 12 Feb 2025 12:32:29 GMT

### Minor changes

- feat(ts-codegen): option to generate mandatory resolver types for graphql type extension (dsamsonov@microsoft.com)

## 2.14.0

Thu, 23 Jan 2025 11:35:51 GMT

### Minor changes

- new --generate-resolver-map flag (pavelglac@gmail.com)

## 2.13.0

Fri, 22 Nov 2024 09:11:34 GMT

### Minor changes

- Context type generation re-worked (77059398+vejrj@users.noreply.github.com)

## 2.12.1

Thu, 24 Oct 2024 13:15:11 GMT

### Patches

- Bump (77059398+vejrj@users.noreply.github.com)

## 2.11.4

Wed, 23 Oct 2024 09:22:25 GMT

### Patches

- remove dependecy on relay-compiler-language-typescript (pavelglac@microsoft.com)

## 2.11.3

Thu, 17 Oct 2024 14:53:14 GMT

### Patches

- bump release version manually (pavelglac@microsoft.com)

## 2.11.1

Mon, 14 Oct 2024 07:58:57 GMT

### Patches

- Bump TS version to 5.5 (pavelglac@microsoft.com)

## 2.11.0

Mon, 15 Jan 2024 17:55:46 GMT

### Minor changes

- export string unions as types (jakubvejr@microsoft.com)

## 2.10.0

Thu, 09 Nov 2023 13:12:42 GMT

### Minor changes

- added parameter to specify GraphQL enums which should remain Typescript enums (jakubvejr@microsoft.com)

## 2.9.0

Mon, 16 Oct 2023 10:17:21 GMT

### Minor changes

- Added possibility to migrate just specified enums to string unions (jakubvejr@microsoft.com)

## 2.8.0

Mon, 16 Oct 2023 09:30:34 GMT

### Minor changes

- ts-codegen can generate only enum files (jakubvejr@microsoft.com)

## 2.7.0

Sun, 08 Oct 2023 15:21:54 GMT

### Minor changes

- Backawrds compatibility changes reverted + added option to enable string unions instead of enums (jakubvejr@microsoft.com)

## 2.6.1

Thu, 21 Sep 2023 06:28:45 GMT

### Patches

- Add exports entry for types to package.json (sverre.johansen@gmail.com)

## 2.6.0

Wed, 02 Aug 2023 12:50:20 GMT

### Minor changes

- enums in types are now string unions by default and added backwards compatibility flag + deprecation fixes (jakubvejr@microsoft.com)

## 2.5.0

Tue, 20 Jun 2023 11:38:47 GMT

### Minor changes

- Bump TS version in dev, move TS to peerDep (mnovikov@microsoft.com)

## 2.4.3

Mon, 29 May 2023 13:14:30 GMT

### Patches

- HOTFIX: Removed unused enums import in model files (jakubvejr@microsoft.com)

## 2.4.2

Wed, 10 May 2023 11:46:01 GMT

### Patches

- HOTFIX: don't generate type extensions in models (jakubvejr@microsoft.com)

## 2.4.1

Tue, 09 May 2023 16:38:29 GMT

### Patches

- HOTFIXES: empty files + unsused imports + @import directive fixed (jakubvejr@microsoft.com)

## 2.4.0

Tue, 28 Mar 2023 10:27:19 GMT

### Minor changes

- Revert \* exports for enums (mnovikov@microsoft.com)

## 2.3.0

Mon, 27 Mar 2023 13:30:13 GMT

### Minor changes

- Export \* enums (mnovikov@microsoft.com)

## 2.2.0

Thu, 16 Mar 2023 15:48:01 GMT

### Minor changes

- Add ability to specify model scope (mnovikov@microsoft.com)

## 2.1.1

Mon, 06 Mar 2023 15:25:06 GMT

### Patches

- Hotfix to make enums generate in legacy model mode (mnovikov@microsoft.com)

## 2.1.0

Mon, 06 Mar 2023 13:47:36 GMT

### Minor changes

- More legacy options for fun and glory (mnovikov@microsoft.com)

## 2.0.0

Wed, 01 Mar 2023 10:48:32 GMT

### Major changes

- Big updates to ts-codegen, legacy mode, news names (mnovikov@microsoft.com)

## 2.0.0-beta.9

Tue, 21 Feb 2023 14:58:31 GMT

### Changes

- legacy Scalars fixed (jakubvejr@microsoft.com)

## 2.0.0-beta.8

Tue, 21 Feb 2023 10:16:35 GMT

### Changes

- Legacy interfaces fix (jakubvejr@microsoft.com)

## 2.0.0-beta.7

Mon, 20 Feb 2023 11:17:56 GMT

### Changes

- Models and Inputs exported in LegacyModels (jakubvejr@microsoft.com)

## 2.0.0-beta.6

Fri, 17 Feb 2023 23:47:12 GMT

### Changes

- [HOTFIX] models and legacyTypes import local enums (jakubvejr@microsoft.com)

## 2.0.0-beta.5

Fri, 17 Feb 2023 17:47:03 GMT

### Changes

- Enums re-exported in LegacyTypes (jakubvejr@microsoft.com)

## 2.0.0-beta.4

Thu, 16 Feb 2023 15:13:23 GMT

### Changes

- legacyTypes types export aliasing removed (jakubvejr@microsoft.com)

## 2.0.0-beta.1

Thu, 09 Feb 2023 19:29:55 GMT

### Changes

- Added compat mode + generator re-written (jakubvejr@microsoft.com)

## 1.0.2

Mon, 12 Dec 2022 15:37:15 GMT

### Patches

- remove unsused imports to be able to remove ts-morph (jakubvejr@microsoft.com)

## 1.0.1

Mon, 28 Nov 2022 10:02:53 GMT

### Patches

- Import na Model path fixed (jakubvejr@microsoft.com)

## 1.0.0

Mon, 21 Nov 2022 14:12:11 GMT

### Major changes

- Supermassive split into multiple packages (jakubvejr@microsoft.com)
