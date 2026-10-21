# Pins

See the [architecture overview](overview.md) for the broader system context,
[Views](views.md) for views and refs, and [Queries](queries.md) for the queries
that keep pins.

Some questions depend on when they are asked, such as "which chat is the
newest?". A view's answer moves with the data, but a consumer often wants the
answer it got when it first asked: the chat the application opened at start
should not change when another chat becomes the newest.

A consumer can already get that with a round trip: ask a view for the newest
chat's id, then query `chatById` with that id. The id the consumer holds is the
kept answer, and `chatById` stays live. A **pin** does the same in the runtime
and saves the round trip. It finds the answer once per query and redirects to a view
that gives it without depending on when it is asked, its **target**. The query keeps
that ref, so the search never reruns, while the target stays live.

## From a view to a pin

A view that delegates its answer returns a ref, and the ref is live: when
another chat becomes the newest, the view reruns and the query follows the new
ref.

```js
export const newestChat = view({
  resolve: async (_args, { read, ref }) => {
    const newest = await read(newestChatRecord);
    return newest === null ? null : ref(chatById, newest.id);
  },
});
```

To keep the first answer, the definition becomes a pin and names its target:

```js
export const newestChat = pin({
  target: chatById,
  resolve: async (_args, { read, ref }) => {
    const newest = await read(newestChatRecord);
    return newest === null ? null : ref(chatById, newest.id);
  },
});
```

`resolve` is unchanged, and so is the result type, a ref to the target or
`null`, so consumers do not change. A pin is never readable: every read of the
former view becomes a type error, marking the places that wanted the live
answer. Like a view, a pin takes `access`; it is referenceable unless it opts
out, and queryable when it opts in. `ref`, queries, [linking](linking.md), and
the [codec](codec.md) accept pins where they accept views.

The kept answer belongs to the query: another query reaching the same pin asks
again. A one-shot query keeps nothing, so a pin answers it as a view would.

Keeping is the runtime's, not the driver's: whenever a ref reaches a kept pin,
the query's execution takes the kept answer instead of running it, so even a
driver that reruns everything never reruns a pin. The wave that reaches a pin
also runs its target, whether or not the driver follows the ref, so the target
arrives with the pin.

## Rules

A live query asks a pin once and keeps the ref it answers:

- **One target.** Every ref a pin returns leads to its target, which the
  runtime checks, so a pin never chooses between views; that is a live view's
  job. A target is always a view, never a pin.
- **The pin does not rerun** when what it read changes.
- **A new ref asks again.** When the referring view stops returning the same
  ref to the pin, the query drops the kept answer, and a new ref to the pin is
  evaluated again.
- **`null` keeps nothing**, nor does a failure. Until the pin answers with a
  ref, the query subscribes its reads as a view's.

## Pagination

Pins, refs, and [actions](actions.md) are enough to build several pagination
models.

For example, a page reads 40 rows after its cursor and pins the
range they covered. The range reads every row in it, so rows inserted into it
join the page rather than pushing others onto the next one, and it refers to
the next page from its far edge, so consecutive pages neither overlap nor leave
gaps. Keys are unique, so two ranges never share a row. See
[Pagination](pagination.md) for how such pages form, how changes reach them,
and why they stay stable.
