# Change Log - @graphitation/apollo-forest-run

<!-- This log was last generated on Thu, 19 Jun 2025 09:02:13 GMT and should not be manually modified. -->

<!-- Start content -->

## 0.14.0

Thu, 19 Jun 2025 09:02:13 GMT

### Minor changes

- fix(apollo-forest-run): apply optimistic fragment writes correctly (vladimir.razuvaev@gmail.com)

## 0.13.3

Wed, 18 Jun 2025 11:30:48 GMT

### Patches

- fix type for ascendants (pavelglac@microsoft.com)

## 0.13.2

Wed, 18 Jun 2025 08:27:35 GMT

### Patches

- fix(apollo-forest-run): interface selection should be completed once (vrazuvaev@microsoft.com_msteamsmdb)

## 0.13.1

Tue, 17 Jun 2025 14:28:26 GMT

### Patches

- fix(apollo-forest-run): fix bogus optimistic data extract (vrazuvaev@microsoft.com_msteamsmdb)
- log number of notified watchers (pavelglac@microsoft.com)

## 0.13.0

Mon, 16 Jun 2025 10:23:51 GMT

### Minor changes

- log update stats (pavelglac@microsoft.com)

## 0.12.4

Thu, 05 Jun 2025 08:25:20 GMT

### Patches

- fix(apollo-forest-run): fix bogus operation id in extract (vrazuvaev@microsoft.com_msteamsmdb)

## 0.12.3

Wed, 21 May 2025 21:51:44 GMT

### Patches

- fix(apollo-forest-run): correctly write fragments on abstract types (vladimir.razuvaev@gmail.com)

## 0.12.2

Mon, 28 Apr 2025 15:16:24 GMT

### Patches

- fix(apollo-forest-run): use other approach for consistent root-level \_\_typename (vrazuvaev@microsoft.com_msteamsmdb)

## 0.12.1

Fri, 25 Apr 2025 14:47:47 GMT

### Patches

- fix(apollo-forest-run): keep root-level \_\_typename in sync when reading (vladimir.razuvaev@gmail.com)

## 0.12.0

Fri, 11 Apr 2025 16:00:56 GMT

### Minor changes

- feat(apollo-forest-run): cache extract (vrazuvaev@microsoft.com_msteamsmdb)

## 0.11.0

Thu, 10 Apr 2025 13:29:51 GMT

### Minor changes

- feat(apollo-forest-run): support custom logger and rudimentary telemetry (vrazuvaev@microsoft.com_msteamsmdb)

## 0.10.2

Tue, 01 Apr 2025 16:22:07 GMT

### Patches

- fix(apollo-forest-run): treat incorrect list items the same way as InMemoryCache (vrazuvaev@microsoft.com_msteamsmdb)

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
