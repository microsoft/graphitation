# Change Log - @graphitation/ts-codegen

This log was last generated on Wed, 02 Aug 2023 12:50:20 GMT and should not be manually modified.

<!-- Start content -->

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
