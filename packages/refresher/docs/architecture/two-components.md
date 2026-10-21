# Two-component architecture

See the [architecture overview](overview.md) for the broader system context and
[Consistency](consistency.md) for the guarantees Refresher gives on its own.

TODO:

- The two components: Refresher as the reactive view layer (reads), and the
  transactional store as the MVCC/OCC write layer, and why the project is split
  this way.
- The interface between them: reads as of a revision, and a commit log that is
  the change feed, delivering each commit as one change event.
- What the pair guarantees: snapshot consistency, atomic visibility of
  multi-store writes, and read-your-writes through views inside a write
  transaction.
- Bringing stores up: loading persisted records and choosing storage, owned by
  the transactional store.
- Testing the pair: how the transactional store's tools cover the data source
  that Refresher's simulation plays on its own.
- Other sources with the same versioned-read and atomic-commit semantics, and
  how they get the same guarantees.
