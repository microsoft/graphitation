# Actions as data

> **Design in progress.** Actions as data are still being designed; this
> document describes their intent.

See the [architecture overview](overview.md) for the broader system context,
[Views](views.md#refs-and-boundaries) for refs, and [Codec](codec.md) and
[Linking](linking.md) for how refs become data and back.

Views return the data a UI shows. A UI also acts on that data: it likes a
message, archives a chat, follows a link. **Actions as data** let a view
describe those actions in its result, the way it describes data it delegates:
with a ref. A view returns `action(likeMessage, args)`, and the UI runs
whatever action ref it receives through one interface of the application's
own, such as `run(item.like)`.

```js
import { view } from "@graphitation/refresher";
import { likeMessage } from "./actions";

export const messageItem = view({
  name: "messageItem",
  async resolve(messageId, { read, ref, action }) {
    const [entry, liked] = await Promise.all([
      read(messages.record, messageId),
      read(likedByMe, messageId),
    ]);
    if (!entry.present) return null;
    return {
      body: entry.value.body,
      likes: ref(messageLikes, messageId),
      like: liked ? null : action(likeMessage, { messageId }),
    };
  },
});
```

```jsx
<button disabled={!item.like} onClick={() => run(item.like)}>
  Like
</button>
```

Refresher never runs an action. Writes and effects stay with the application,
as they do without actions: an action ref is a typed address, and Refresher
only builds, carries, and encodes it. The application's runner runs it,
and the effects reach views back through change feeds, like any other write.

The idea is familiar from hypermedia: a page carries links and forms along with
its content, and a client follows them without knowing in advance which URLs
exist. In React terms, an action ref is an event handler prop that is also
serializable data.

## What an action is

An action is a value of the application's own that Refresher can carry in a
ref, and is opaque to it. Any function or object that is not a view is an
action; no project declaration is needed. Its optional `name` labels it in
traces, errors, and devtools, and is never its identity.

A function's first parameter is the type of its arguments, and its return type
is its result, so its action refs are typed by it.

> **Open.** How actions that are not functions, such as command objects, type
> their arguments and results is open; their action refs take any arguments.

## Action refs

`action(target, args, meta)` makes an **action ref** to the action `target`,
just as `ref(view, args, meta)` makes a ref to a view. It is a frozen record
anyone may read: its `action`, its `args` as captured, and its `meta`. `isRef`
matches both kinds, and the record tells which: a view ref names its `view`, an
action ref its `action`.

The arguments of an action ref follow the rules for
[view arguments](views.md#refs-and-boundaries): they are JSON values and hold no
refs, though they may hold [external refs](federation.md#reading-external-refs),
which are data. Two action refs are equal when they name the same action and
their arguments are equal under the session's [codec](codec.md), so a view
that reruns and returns an equal action ref returns an equal value.

An action ref is not a view ref:

- **It is never evaluated.** It has no view instance, no reads, and no result.
  It creates no update, sharing, or error boundary.
- **It is never read.** A view that receives one holds it, passes it on, or
  returns it.
- **It is a leaf.** Within a result it is data, like a string. It is part of
  the value of the view that returned it, tracked and republished with it.

## Affordances as live data

Whether an action is offered is data a view computes from what it reads. A view
returns an action ref where the action applies and leaves it out where it does
not: `like` above is `null` once the message is liked. Since an action ref is
part of its view's value, a live query republishes it when the data deciding it
changes, and the UI offers exactly the actions the current data allows.

This keeps the rules for an action next to the data they depend on, in the
view, rather than repeated in every component that shows a button for it.
Refresher does not enforce them: the application's runner still decides
whether an action may run.

## Running actions

Running actions belongs to the application. Its **runner** receives an action
ref, finds the action, and runs it with the ref's arguments: locally, by posting
it to a worker, or by sending it to a server. One `run(ref)` serves
every action whatever its target, so components run actions the same way
they render data, without importing what the action does.

Refresher supplies the types an action ref carries, so a runner can be
typed by the action and its arguments. It ships no runner, and an action's
result, failures, retries, and optimistic updates are the runtime's concern.
See [Optimistic overlay](federation.md#optimistic-overlay) for showing pending
writes in views.

Many actions need input only the UI has, such as the text of a new message. A
view leaves that [input](variables.md) open, and the runner binds it with the
UI's value:

```js
send: action(sendMessage, { chatId, text: input("text") }),
```

```jsx
<button onClick={() => run(data.send, { text: draft })}>Send</button>
```

The action ref's type carries its open inputs, so a runner can require
exactly those. See [Variables](variables.md#actions).

### Effect

Since an action is opaque to Refresher, an action may be written with
[Effect](https://effect.website): a function from its arguments to an
`Effect` whose success is what the action answers. Its action refs are typed
by it as any function's are, and the codec identifies it as it identifies any
action.

The runner is then an Effect runtime of the application's own. It provides
what actions require, such as reading views or writing stores, as Effect
services, so an action's requirements type which runner can run it, and it
forks each action it runs as a fiber. Failures, retries, timeouts, and
interruption come from Effect: a UI that leaves a screen, for example, may
interrupt the actions it ran there.

Views are unaffected: they keep Refresher's `resolve`, and an action that reads
a view reads it through a service the runner provides.

## Query drivers

A [query driver](execution.md#query-drivers) never follows an action ref.
What a driver materializes an action ref into is its own choice: it may leave
it as it is, encode it for its transport, or turn it into something its
consumer calls, such as a callback bound to the application's runner. A
driver may also schedule effects of its own, outside what Refresher describes.

## Encoding and linking

An action ref crosses to another session, is persisted, or is handed to a
consumer as data, the same way a view ref does. The session's
[codec](codec.md) issues **action ids**, as it issues view ids, and encodes an
action ref as its action id and its arguments. The default codec gives each
action a local id, readable from its `name` and valid only within its session.
Action refs that cross a boundary or are persisted need a project codec that
names actions stably, since function names change under minification.

Mapping an action id back to an action is necessary wherever an encoded action
ref is run. It may work the same way [linking](linking.md#linking-ids)
does for view ids, and it belongs to the project: Refresher neither links action
ids nor requires a particular scheme.

Across sessions, an answer holds action refs encoded, and the asking session
holds them as they are, as **external action refs**: a string or a number,
typed `ExternalActionRef<Action, Inputs>` by the action it names and the
[inputs](variables.md#actions) it leaves open. Like an
[external ref](federation.md#reading-external-refs), it is data to its session,
so it may be an argument; unlike one, it is never read. The application's
runner decodes and runs it, with values for its open inputs: typically by
sending it back to the session that offered it, which binds and runs it.
