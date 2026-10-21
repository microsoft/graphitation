# Codec

> **Design in progress.** The codec's role and contract are still being
> designed and are likely to change.

See the [architecture overview](overview.md) for the broader system context, and
[Views](views.md) for the arguments and results a codec handles.

A session's **codec** gives view instances a stable identity. A view
instance is a definition plus its arguments, so two arguments that the codec
considers equal name the same instance and share its recorded reads and cached
result. Equal arguments are identified as equal whatever their property order.

The codec also names the views themselves. View ids are part of the system's
schema, as argument and result definitions are, so the codec issues them and
defines what they look like. The default codec names a view by the `id` it
declares, and any other view by a local id that carries the view's `name`, such
as `__messageItem_1`; a custom codec may name views its own way. A local id is
not portable to another session. Linking an id back to a view belongs to
[linking](linking.md#linking-ids). Sessions that exchange refs use codecs that agree on both the
view ids and the argument keys.

The codec names [actions](actions.md#encoding-and-linking) the same way, so an
action ref can be encoded as an action id and its arguments: `actionKey` issues
the id, and `captureActionArgs` and `actionArgsKey` treat action arguments as
`captureArgs` and `argsKey` treat a view's. Action ids and view ids are separate
namespaces. The default codec
gives each action a local id; an action ref that crosses a boundary or is
persisted needs a codec that names actions stably.

Arguments may hold [open inputs](variables.md#encoding), placeholders a consumer
binds later. The codec encodes each with its name and the view that left it
open, in a form no argument value can be mistaken for.

A session that names no codec uses the default one, which is schemaless and
relies on TypeScript types alone, so an application can start with plain views
and add schemas when it needs runtime checks. A custom codec can add schema
validation or keys that are easier to read.

Arguments are JSON values, so identity needs no custom rules and survives any
transport. A `Date` counts as its JSON form, an ISO timestamp, so it names the
same instance as that timestamp string. An argument outside JSON, such as a
`Map` or a `Blob`, is a **value** error, and so is a ref anywhere in
arguments: [arguments hold no refs](views.md#refs-and-boundaries).

A codec sees values at two moments: when arguments become part of an
instance's identity, and when a session publishes a result. Each time it also
receives the definition of the view the value belongs to, along with the
view's schema if it declares one. A schema-aware codec can validate values at
those moments and report an invalid value as a **value** error at the path
where it was found. See [Errors](errors.md). It can also use the argument
definitions to identify arguments, for example by writing fields in the order
the definition declares them.

An argument key is opaque and compared only within one view. It may encode the
arguments, or be a short alias the codec issued for them, kept for a session
or persisted between runs. Because the codec receives the definition, it can
choose a different scheme per view. An instance's identity combines the view's id
and that key as the codec defines, such as `ChatRoomV1:<key>`, and means nothing
more; whatever needs the arguments themselves carries them.

A codec also finds the refs in a settled result, for a driver that follows
them. Refs are leaves of the search: what a ref leads to is another instance.
[Action refs](actions.md) are leaves too, and the codec tells them from view
refs.
Equal results yield their refs in the same order, and a codec may also tell
where each ref is, as a path linked from the ref back to the result, so refs
under one parent share its path and none is copied. The JSON codec
searches arrays, plain objects, `Map`s and `Set`s and tells no paths; a
schema-aware codec can search only where its schema puts refs.

## Conventions

A custom codec is also where a project encodes its own contracts, such as how
views are named and how their arguments are keyed, alongside its data formats.
Refresher ships reference implementations.

## Schemas

A view's schema pairs two things:

- **Runtime definitions** of its arguments and its result, in the vocabulary of
  the session's codec. Refresher never reads them. A definition can be
  self-contained, such as a validation library's schema, or name a type the
  codec already holds, such as a GraphQL type reference like `Chat!`. A codec
  rejects a definition it does not recognize.
- **TypeScript types** for the same arguments and result. A definition does not
  have to carry its own types, so they travel beside it. Generated code can
  supply both halves at once.

```ts
// Generated from a GraphQL schema.
export const ChatSchema: ViewSchema<ChatArgs, Chat> = {
  args: { id: "ID!" },
  result: "Chat!",
};

// Arguments and result are typed by the schema.
export const chat = view({ schema: ChatSchema, resolve: (args, { read }) => ... });
```

A view without a schema infers its types from `resolve`. The default codec
needs no schema; a strict codec may require one.

Without runtime validation, Refresher relies on TypeScript. Views, refs, and
query results are statically typed, and results reach consumers as views
returned them.

Finding refs inside a result and encoding values for another session belong to
query drivers, which know where refs are selected and what their transport
can carry. See [Execution](execution.md).

Views, stores, and execution are written the same way under any codec, so a
session can adopt a schema-aware codec without changing how data is composed.
