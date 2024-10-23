# Change Log - @graphitation/embedded-document-artefact-loader

<!-- This log was last generated on Wed, 23 Oct 2024 09:22:25 GMT and should not be manually modified. -->

<!-- Start content -->

## 0.8.5

Wed, 23 Oct 2024 09:22:25 GMT

### Patches

- remove dependecy on relay-compiler-language-typescript (pavelglac@microsoft.com)

## 0.8.4

Tue, 22 Oct 2024 16:48:19 GMT

### Patches

- fix after react 18 bump (Stanislaw.Wilczynski@microsoft.com)

## 0.8.3

Thu, 17 Oct 2024 14:53:14 GMT

### Patches

- bump release version manually (pavelglac@microsoft.com)

## 0.8.1

Mon, 14 Oct 2024 07:58:57 GMT

### Patches

- Bump TS version to 5.5 (pavelglac@microsoft.com)

## 0.8.0

Thu, 02 May 2024 07:33:39 GMT

### Minor changes

- Add artifactDirectory option support to ts-jest (mwanginjuguna59@gmail.com)

## 0.7.0

Wed, 28 Feb 2024 17:44:01 GMT

### Minor changes

- Add support for artifactDirectory to loader (mark@thedutchies.com)

## 0.6.9

Mon, 29 Jan 2024 22:07:50 GMT

### Patches

- Remove trailing interpolations from Nova queries (iukondra@microsoft.com)

## 0.6.8

Tue, 31 Oct 2023 00:45:05 GMT

### Patches

- No behavior change, just makes the loader only do work when there are graphql tags (kchau@microsoft.com)

## 0.6.7

Mon, 09 Oct 2023 22:53:02 GMT

### Patches

- Return pure JS object instead of generator (eloy.de.enige@gmail.com)

## 0.6.6

Mon, 09 Oct 2023 20:58:06 GMT

### Patches

- [loader] Never return a generator, use JSON where possible (eloy.de.enige@gmail.com)

## 0.6.5

Wed, 04 Oct 2023 06:06:12 GMT

### Patches

- [loader] Pass on source-map when not transforming (eloy.de.enige@gmail.com)

## 0.6.4

Thu, 21 Sep 2023 06:28:45 GMT

### Patches

- Add exports entry for types to package.json (sverre.johansen@gmail.com)

## 0.6.3

Fri, 15 Sep 2023 22:22:30 GMT

### Patches

- Make jest loader work for async import (eloy.de.enige@gmail.com)

## 0.6.2

Wed, 16 Aug 2023 06:31:21 GMT

### Patches

- Various PeopleApp fixes (eloy.de.enige@gmail.com)

## 0.6.1

Tue, 25 Jul 2023 08:18:03 GMT

### Patches

- Keep loader agnostic to duct-tape specifics and handle refetchable outside of it (eloy.de.enige@gmail.com)

## 0.6.0

Sat, 22 Jul 2023 07:35:09 GMT

### Minor changes

- Use @refetchable(queryName) as artefact filename (eloy.de.enige@gmail.com)

## 0.5.0

Fri, 21 Jul 2023 06:18:50 GMT

### Minor changes

- Webpack and jest now have line source-map support, but coluns are still lacking (eloy.de.enige@gmail.com)

## 0.4.0

Fri, 14 Jul 2023 16:21:39 GMT

### Minor changes

- Rename jest loader to reflect it wrapping ts-jest (eloy.de.enige@gmail.com)

## 0.3.0

Fri, 14 Jul 2023 01:21:51 GMT

### Minor changes

- Adds jest loader (eloy.de.enige@gmail.com)

## 0.2.0

Mon, 19 Jun 2023 22:17:53 GMT

### Minor changes

- Emit source-map for single and multi-line docs (eloy.de.enige@gmail.com)
