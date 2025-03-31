# Change Log - @graphitation/apollo-forest-run

<!-- This log was last generated on Mon, 31 Mar 2025 14:15:49 GMT and should not be manually modified. -->

<!-- Start content -->

## 0.10.1

Mon, 31 Mar 2025 14:15:49 GMT

### Patches

- fix(apollo-forest-run): don't throw on incorrect written data (vrazuvaev@microsoft.com_msteamsmdb)

## 0.10.0

Mon, 31 Mar 2025 11:23:11 GMT

### Minor changes

- Build target ES2018; inlined asserts (vrazuvaev@microsoft.com_msteamsmdb)

## 0.9.3

Fri, 28 Feb 2025 15:25:36 GMT

### Patches

- fix(apollo-forest-run): do not rely on cached key for root-level objects (vrazuvaev@microsoft.com_msteamsmdb)

## 0.9.2

Thu, 27 Feb 2025 12:37:33 GMT

### Patches

- fix(apollo-forest-run): use replaceTree vs addTree to fix incorrect assumption (vrazuvaev@microsoft.com_msteamsmdb)

## 0.9.1

Mon, 24 Feb 2025 13:15:51 GMT

### Patches

- fix(execute): do not visit the same chunk twice when reading (vrazuvaev@microsoft.com_msteamsmdb)

## 0.9.0

Tue, 04 Feb 2025 12:28:13 GMT

### Minor changes

- Revert changes that prooved making perf worse (vladimir.razuvaev@gmail.com)

## 0.8.0

Fri, 31 Jan 2025 09:39:55 GMT

### Minor changes

- feat: configurable auto-eviction (vladimir.razuvaev@gmail.com)

## 0.7.0

Tue, 28 Jan 2025 14:30:28 GMT

### Minor changes

- perf: store operations by key constructed from variables (vladimir.razuvaev@gmail.com)

## 0.6.1

Mon, 27 Jan 2025 17:57:15 GMT

### Patches

- fix: prevent excessive re-renders (vladimir.razuvaev@gmail.com)

## 0.6.0

Fri, 13 Dec 2024 15:40:14 GMT

### Minor changes

- Expose explicit data cleanup through Apollo gc() method (vladimir.razuvaev@gmail.com)

## 0.5.0

Fri, 06 Dec 2024 11:56:43 GMT

### Minor changes

- Explicit LRU eviction as a part of write transaction (vladimir.razuvaev@gmail.com)

## 0.4.0

Wed, 13 Nov 2024 14:50:00 GMT

### Minor changes

- fix(apollo-forest-run): do not leak variables when operation is evicted (vladimir.razuvaev@gmail.com)

## 0.3.2

Mon, 28 Oct 2024 15:10:14 GMT

### Patches

- fix(apollo-forest-run): improve compatibility with apollo (vladimir.razuvaev@gmail.com)

## 0.3.1

Fri, 25 Oct 2024 16:52:17 GMT

### Patches

- refactor(apollo-forest-run): replace const enums with ES modules (vladimir.razuvaev@gmail.com)

## 0.3.0

Thu, 24 Oct 2024 18:47:00 GMT

### Minor changes

- zero dependencies for ForestRun (vladimir.razuvaev@gmail.com)

## 0.2.1

Wed, 23 Oct 2024 09:22:25 GMT

### Patches

- remove dependecy on relay-compiler-language-typescript (pavelglac@microsoft.com)

## 0.2.0

Tue, 22 Oct 2024 16:48:19 GMT

### Minor changes

- Initial ForestRun implementation (vladimir.razuvaev@gmail.com)
