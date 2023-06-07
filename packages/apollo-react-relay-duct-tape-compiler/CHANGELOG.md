# Change Log - @graphitation/apollo-react-relay-duct-tape-compiler

This log was last generated on Mon, 22 May 2023 13:58:50 GMT and should not be manually modified.

<!-- Start content -->

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
