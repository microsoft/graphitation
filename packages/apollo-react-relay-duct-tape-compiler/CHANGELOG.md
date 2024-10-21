# Change Log - @graphitation/apollo-react-relay-duct-tape-compiler

<!-- This log was last generated on Thu, 17 Oct 2024 14:53:14 GMT and should not be manually modified. -->

<!-- Start content -->

## 1.5.6

Thu, 17 Oct 2024 14:53:14 GMT

### Patches

- bump release version manually (pavelglac@microsoft.com)
- Bump @graphitation/graphql-js-tag to v0.9.3
- Bump @graphitation/supermassive to v3.5.5

## 1.5.4

Mon, 14 Oct 2024 07:58:57 GMT

### Patches

- Bump TS version to 5.5 (pavelglac@microsoft.com)
- Bump @graphitation/supermassive to v3.5.3

## 1.5.3

Wed, 03 Jul 2024 17:33:49 GMT

### Patches

- Bump @graphitation/supermassive to v3.5.2

## 1.5.2

Fri, 14 Jun 2024 18:43:53 GMT

### Patches

- Bump @graphitation/supermassive to v3.5.1

## 1.5.1

Tue, 16 Apr 2024 00:44:40 GMT

### Patches

- fix defaultValue as object for @argumentDefinitions (dragoshomner@microsoft.com)

## 1.5.0

Mon, 25 Mar 2024 20:42:32 GMT

### Minor changes

- align generated types with relay-compiler >=15.0.0 (dragoshomner@microsoft.com)

## 1.4.1

Thu, 07 Mar 2024 13:08:30 GMT

### Patches

- Bump @graphitation/supermassive to v3.5.0

## 1.4.0

Tue, 16 Jan 2024 04:23:53 GMT

### Minor changes

- Added missing dependencies to yargs (sverre.johansen@gmail.com)

## 1.3.13

Mon, 15 Jan 2024 17:55:46 GMT

### Patches

- Bump @graphitation/supermassive to v3.4.2

## 1.3.12

Mon, 15 Jan 2024 17:31:26 GMT

### Patches

- Bump @graphitation/supermassive to v3.4.1

## 1.3.11

Wed, 10 Jan 2024 12:26:58 GMT

### Patches

- Bump @graphitation/supermassive to v3.4.0

## 1.3.10

Tue, 09 Jan 2024 09:30:02 GMT

### Patches

- Bump @graphitation/supermassive to v3.3.0

## 1.3.9

Tue, 12 Dec 2023 17:37:30 GMT

### Patches

- Bump @graphitation/supermassive to v3.2.7

## 1.3.8

Tue, 12 Dec 2023 13:48:37 GMT

### Patches

- Bump @graphitation/supermassive to v3.2.6

## 1.3.7

Thu, 09 Nov 2023 13:12:42 GMT

### Patches

- Bump @graphitation/supermassive to v3.2.5

## 1.3.6

Tue, 07 Nov 2023 14:42:59 GMT

### Patches

- Bump @graphitation/supermassive to v3.2.4

## 1.3.5

Mon, 16 Oct 2023 10:17:21 GMT

### Patches

- Bump @graphitation/supermassive to v3.2.3

## 1.3.4

Mon, 16 Oct 2023 09:30:34 GMT

### Patches

- Bump @graphitation/supermassive to v3.2.2

## 1.3.3

Sun, 08 Oct 2023 15:21:54 GMT

### Patches

- Bump @graphitation/supermassive to v3.2.1

## 1.3.2

Thu, 28 Sep 2023 12:04:15 GMT

### Patches

- Bump @graphitation/supermassive to v3.2.0

## 1.3.1

Wed, 27 Sep 2023 14:33:57 GMT

### Patches

- Fix transforms to actually do both v3 and v2 (mnovikov@microsoft.com)

## 1.3.0

Wed, 27 Sep 2023 08:50:33 GMT

### Minor changes

- Support supermassive v3 annotations (mnovikov@microsoft.com)
- Bump @graphitation/supermassive to v3.1.0

## 1.2.4

Thu, 21 Sep 2023 06:28:45 GMT

### Patches

- Add exports entry for types to package.json (sverre.johansen@gmail.com)
- Bump @graphitation/graphql-js-tag to v0.9.1
- Bump @graphitation/supermassive-ast to v2.0.1

## 1.2.3

Wed, 16 Aug 2023 06:31:21 GMT

### Patches

- Various PeopleApp fixes (eloy.de.enige@gmail.com)

## 1.2.2

Tue, 25 Jul 2023 08:18:03 GMT

### Patches

- Re-export the right docs for a fragment (eloy.de.enige@gmail.com)

## 1.2.1

Sat, 22 Jul 2023 07:35:09 GMT

### Patches

- Backport compiler fixes from TMP (eloy.de.enige@gmail.com)

## 1.2.0

Tue, 20 Jun 2023 11:38:47 GMT

### Minor changes

- Bump TS version in dev, move TS to peerDep (mnovikov@microsoft.com)

## 1.1.0

Mon, 19 Jun 2023 12:22:22 GMT

### Minor changes

- Move to supermassive-ast package (mnovikov@microsoft.com)
- Bump @graphitation/supermassive-ast to v2.0.0

## 1.0.0

Mon, 12 Jun 2023 12:50:51 GMT

### Patches

- Bump @graphitation/supermassive to v2.4.8

## 1.0.0-alpha.2

Mon, 22 May 2023 13:58:50 GMT

### Changes

- Testing release (eloy.de.enige@gmail.com)
- Bump @graphitation/supermassive to v2.4.4

## 0.8.2

Mon, 24 Jan 2022 13:40:52 GMT

### Patches

- Fix Webpack 4 compat (mnovikov@microsoft.com)

## 0.8.1

Thu, 06 Jan 2022 09:53:33 GMT

### Patches

- typecript version changed from ^4.2.3 to >=4.2.3 based on https://github.com/microsoft/graphitation/pull/78 (jakubvejr@microsoft.com)

## 0.8.0

Wed, 05 Jan 2022 15:09:43 GMT

### Minor changes

- We were facing an error in relay-compiler-language-typescript: 14.0.0. issue described here, which caused a syntax error in generated files. With >=14.0.0 in this update we wanted to not force apps which use the graphitation plugin to have TS version 4.5 or greater. (jakubvejr@microsoft.com)

## 0.7.0

Thu, 23 Dec 2021 11:31:14 GMT

### Minor changes

- Added proper mjs builds (bump for main release) (mnovikov@microsoft.com)

## 0.6.0

Tue, 14 Dec 2021 10:13:54 GMT

### Minor changes

- Support ESM in distro packages (mnovikov@microsoft.com)

## 0.5.3

Tue, 26 Oct 2021 21:09:29 GMT

### Patches

- Ensure that all packages listing graphql as a peerDependency also has it as a devDependency (modevold@microsoft.com)

## 0.5.2

Tue, 26 Oct 2021 12:46:12 GMT

### Patches

- Align graphql dependency to version ^15.0.0 across packages (modevold@microsoft.com)

## 0.5.1

Sat, 24 Apr 2021 23:10:54 GMT

### Patches

- Include commonjs modules (eloy.de.enige@gmail.com)

## 0.5.0

Fri, 23 Apr 2021 21:44:28 GMT

### Minor changes

- First proper release (eloy.de.enige@gmail.com)

### Patches

- fixing the publish process, publishing a new patch level (kchau@microsoft.com)
- fixing the publish process, publishing a new patch level (again) (kchau@microsoft.com)
- Include correct files (eloy.de.enige@gmail.com)
