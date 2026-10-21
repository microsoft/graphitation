# Performance and memory

See the [architecture overview](overview.md) for the broader system context and
[Configuration](configuration.md) for the settings referred to here.

TODO:

- Store view precision: how what a store view matches and how a view reads decide
  what reruns, and the tools that help keep both precise (reference store views,
  contract checkers, explanations, traces).
- Refs and inline reads as a performance choice: update boundaries, shared
  instances, and what a rerun costs on each side.
- Rounds and batched reads, and how preloading reduces round trips.
- Memory: what a session holds per view instance, per recorded read, per live
  query, and per cached result, and what releases it.
- View caching: when keeping results pays off, what it costs to keep them, and
  the memory the change log holds to validate them.
- Crossing boundaries: encoding, round trips, and where to place views.
- Measuring: traces, session inspection, and their cost.
