# Configuration

See the [architecture overview](overview.md) for the broader system context and
[Sessions](session.md) for what a session is given.

TODO:

- Resource limits a session applies: view instances, graph depth, inline-read
  depth, waves per execution, recorded reads, and the default and maximum page
  size of a collection read. Their defaults and the units they count.
- Where each limit applies: per read, per execution, or per session.
- Whether a query or a single read may lower a limit for itself.
- How exhausting a limit is reported, and what a live query does when an update
  pass exceeds one.
- Retention policies: the view-cache eviction policy, the change-log window, and persistence.
- Diagnostics: turning tracing and session inspection on and off.
- Which settings belong to a session and which to a query.
- Whether any policy can change on a running session.
- Per-request budgets for an answering session in federation.
