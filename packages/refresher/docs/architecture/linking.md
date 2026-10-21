# Linking

See the [architecture overview](overview.md) for the broader system context,
[Views](views.md#refs-and-boundaries) for what a ref is, and
[Environments](environments.md) for sessions that use each other's views.

Views compose by importing each other. A view reaches another by importing it
and passing it to `read` or `ref`, so a reference is an ordinary module edge and
the reference graph is the module graph. This is the arrangement React uses for
components, and it brings the same benefits:

- **Existing tooling.** Circular, unreachable, and unused definitions are import
  questions, and bundlers, linters, and editors already answer them. Views that
  nothing imports are tree-shaken.
- **Recursion.** Views that refer to each other work the way mutually recursive
  functions do.
- **Definitions are values.** A view definition can be passed, wrapped, or
  produced by a factory, and needs no registration step.

A definition object is its own identity. `name` is a label for diagnostics,
and two views with the same label are still two views.

**Linking** covers the one case imports cannot: a ref encoded as data. An
encoded ref crosses to another session, is persisted, or is handed to a
consumer, and data cannot carry a definition. It carries an **id** instead, and
the receiving session resolves that id back to a definition.

## View ids

An encoded ref names its view by a **view id** and carries the view's
arguments. The session's [codec](codec.md) issues view ids: the default codec
uses the `id` a view declares, and gives any other view a local id.

```js
export const roomView = view({
  id: "ChatRoomV1",
  resolve: (chatId, { ref }) => ({ messages: ref(messagesView, chatId) }),
});
```

A declared id is an application-facing address, like a route or an API
endpoint. Renaming it, or changing the arguments its view accepts, can break
refs that are stored or in flight, so a versioned id such as `ChatRoomV1` gives
a view room to change. A local id stays within its session and lasts as long as
the session does.

A view instance is named by its view's id and a key for its arguments, as in
`ChatRoomV1:<key>`. The session's codec writes both and defines how they
combine. The name is compared only for equality, and the key has no meaning
outside the codec.

## Linking ids

A session that receives an encoded ref links its view id back to a definition.
Most sessions need none of this: views reach each other through imports, and a
ref that stays inside its session keeps its definition. Ids need linking where
refs cross as data: [federation](federation.md), and refs that are persisted or
handed to a consumer. A session that takes part in those is given a **linker**,
which maps the ids it accepts to views. Linking a view runs nothing: evaluation
starts when a query or another session asks for it.

> **TODO.** The shape of the linker is still open. An explicit list of views,
> a lazy map of imports, and one generated at build time all fit.

## External views

An **external view** is a typed address for a view, declared by its id without
importing the definition:

```js
import type { roomView } from "./Room";

const room = external < typeof roomView > "ChatRoomV1";

const sidebarView = view({
  resolve: async (userId, { read, ref }) => {
    const chatIds = await read(chatIdsView, userId);
    return chatIds.map((chatId) => ref(room, chatId));
  },
});
```

The signature comes from a type argument, so a type-only import is enough, and
none of the definition's code enters the bundle. Where even a type-only import
would form a cycle, the signature can be written out as `View<Args, Result>`.

A session links an external view the first time an execution reaches it:

1. A view the session's linker maps that id to runs locally.
2. Otherwise a connected session runs it. See [Federation](federation.md).
3. Otherwise the reference fails with a **ref** error. See [Errors](errors.md).

Linking locally first gives external views two uses. Within one session, an
external view breaks an import cycle, or a TypeScript inference cycle, between
views that reach each other. Across sessions, the same declaration reads a view
only another session runs, through that session's
[remote store](federation.md#reading-another-sessions-views). Its answer holds
[external refs](federation.md#reading-external-refs) wherever the view runs, so
moving a view to another session changes where it runs, and the views that read
it stay the same.

An external view has no identity of its own. Its instance is the linked view's
instance with the same arguments, so reading through the external view and
through the definition shares one instance.

## Linking and access

An external view is declared readable, referenceable, and queryable. The view
it links to applies its own [access](views.md#access) rules, so an id grants no
more than the view allows: a view that is not referenceable cannot be reached
through a ref, encoded or not, and one that is not queryable cannot be a
query's root.

A session resolves the refs a query actually follows. Which refs those are is up
to the [query driver](execution.md): a standard driver follows every ref, and a
GraphQL driver follows its selection set. A
ref that is never followed needs nothing to link to.

Applications create refs with `ref` and pass them along without looking inside.
How a ref is encoded, and how an encoded ref from another session maps back to
a view, belong entirely to the query driver that carries it: plain ids, signed
tokens and encrypted handles are all the driver's choice. The session links
ids, and every driver in a session maps an encoded ref to the same view. A
session reads external refs through a view keyed by them, such as a remote
store's `views`; see [Federation](federation.md#reading-external-refs).

## What a ref does not carry

A ref names a view and its arguments, and nothing else: no revision, no cached
result, no connection, and no subscription. Resolving a ref reads the data that
is current when it runs, so a persisted ref is an address for a future query,
and the result it leads to is computed afresh.

## Action refs

An [action ref](actions.md) encoded as data carries an action id instead of a
view id. Running it needs the action id mapped back to an action, which
could work as linking view ids does. That mapping belongs to the application:
the session links no action ids.
