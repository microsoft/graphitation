# Variables

> **Design in progress.** Variables are still being designed; this
> document describes their intent.

See the [architecture overview](overview.md) for the broader system context,
[Views](views.md#refs-and-boundaries) for refs, [Actions](actions.md) for action
refs, and [Execution](execution.md#query-drivers) for query drivers.

Every argument of a view or an action is an **input**. Most inputs are known
to the view that makes the ref: the chat a composer belongs to, the message a
like button likes. Some are known only to the ref's consumer: the text typed
into the composer, the size of a page to load. A view leaves such an input
**open** with `input(name)`, and the consumer supplies its value later, when it
follows or runs the ref.

```js
import { view } from "@graphitation/refresher";
import { sendMessage } from "./actions";

export const composer = view({
  name: "composer",
  resolve: ({ chatId }, { action, input }) => ({
    send: action(sendMessage, { chatId, text: input("text") }),
  }),
});

export async function sendMessage({ chatId, text }, { store }) {
  // ...
}
```

```jsx
<button onClick={() => run(data.send, { text: draft })}>Send</button>
```

The action takes all its inputs as arguments, whichever side supplies them, so
it reads the same as an action whose arguments the view knows in full.

Open inputs are satisfied by **variables**, which the consumer supplies. The
terms come from GraphQL: a field's arguments are its inputs, and in
`messages(first: $pageSize)`, `first` is an input and `$pageSize` a variable.
An open input is a field argument: its name is part of the ref, like the
argument's name is part of the field. A variable's name is the consumer's: a
runner passes variables named like the inputs they fill, and a query driver
maps the query's variables onto inputs.

## Leaving inputs open

`input(name)` comes from the context of `resolve`, next to `read`, `ref`, and
`action`. It may stand for any input at any depth of the arguments passed to
`ref` or `action`: a field, an array element, or the whole arguments.

```js
ref(chatMessages, { chatId, first: input("first"), after: input("after") });
action(moveCard, { cardId, to: { column: input("column"), index: 0 } });
```

The name is the one a consumer supplies a value by. One name used in several
positions takes one value for all of them.

An open input is opaque to the view that leaves it. The view can place it,
never read its value, so the view's result is the same whatever values its
consumers supply, and every consumer shares one instance of it.

For the same reason, `read` takes no open inputs. Reading needs a value now,
and an open input has none until a consumer supplies it. An open input passed
to `read` fails to compile, and is a **value** error where types do not catch
it.

### Defaults

An open input may have a **default**, the value it takes when its consumer
supplies none: `input("first", { default: 20 })`. A default makes the input
optional for consumers, and fits the position the input stands in, as any value
would.

```js
ref(chatMessages, { chatId, first: input("first", { default: 20 }) });
```

A default is part of the template. Two templates that differ only in a default
are different templates, though their bound refs are equal when they bind to
equal arguments.

## Templates and binding

A ref with open inputs is a **template**. It is part of the value of the view
that made it, like any ref, and is equal to another template when they name the
same view or action, with equal arguments and the same inputs open in the same
positions.

**Binding** a template supplies a value for each open input, and gives an
ordinary ref: one whose arguments are the inputs in full. A template is never
evaluated or run itself; its bound refs are. A view ref bound with
different values leads to different instances, each keyed by its bound
arguments, as if a view had made it with those arguments. A bound view ref
carries that key as its `instanceId`; a template, naming no instance yet, has
none.

Binding needs a value for every open input without a default; an input with
one takes its default when no value is supplied. A missing value is a **value**
error at the template. Values for inputs a template does not have are ignored, so one
set of values can bind several templates.

`runtime.bind(ref, values)` binds a template outside any query or runner,
such as in a test or in a runner of the application's own.

## Types

An open input is typed by the position it stands in. `input("text")` in the
`text` field of `sendMessage`'s arguments takes a string, and a ref carries its
open inputs in its type:

```ts
const send = action(sendMessage, { chatId, text: input("text") });
// ActionRefTemplate<typeof sendMessage, { readonly text: string }>

run(send, { text: "hello" }); // compiles
run(send); // fails: `text` is missing
run(send, { text: 1 }); // fails: `text` is a string
```

An input with a default is optional, typed `{ readonly first?: number }`. A
ref without open inputs, or with only optional ones, takes no values, so
`run(like)` needs no second argument. A name that stands in positions of different types takes a value of
all of them.

A ref fits where a consumer supplies at least the inputs it leaves open, with
values its positions accept. A ref that leaves fewer inputs open, or accepts
wider values, fits too, the way a GraphQL resolver may ignore an argument.

A template is typed `RefTemplate` or `ActionRefTemplate`, and binding returns
a `Ref` or `ActionRef`, which leaves no input open. A template does not fit
where a `Ref` or `ActionRef` is required, so a consumer that receives one
cannot use it as an ordinary ref by mistake: a driver or runner that only takes
bound refs fails to compile on a template. A bound ref fits wherever a template
does.

## Supplying variables

### Actions

An action ref is never followed, so the application's runner binds it, with
variables from the UI: `run(data.send, { text })`. It may supply the values
itself, bind them on another thread, or send the template and its values to a
server to bind there.

### Queries

A query driver binds each template before following it, so the instance it
leads to is the bound one. Which variables fill which inputs is part of the
driver's [demand](execution.md#query-drivers):

- **A GraphQL executor** binds a template by the field it stands in, from the
  field's arguments in the selection set, resolving the operation's variables
  as GraphQL does. One field selected twice under different aliases, as
  `a: messages(first: 10)` and `b: messages(first: 20)`, leads to two instances.
- **The standard query** takes variables grouped by the view that made each
  template, each named like the input it fills, so two views may open inputs
  of one name without clashing. Every instance of a view takes the same
  variables, so values that differ per instance belong in the view's
  arguments.

A template whose open inputs without defaults the driver supplies no
variables for is a **value** error at that ref, and is not followed. Variables are fixed for a query: other
values make another query, which shares every instance whose arguments did not
change.

What a driver materializes a template it does not follow into is its own
choice, as for any ref: it may leave it as a template for its consumer to bind.

> **Open.** How a query is handed its variables is part of the query
> contract, which is being redesigned. See [Queries](queries.md).

> **Open.** Relay's fragment variables have no counterpart in views, and need
> none: a view's own arguments play the part of a fragment's local arguments,
> its open inputs that of the operation's variables it uses, and binding a
> template again plays the part of refetching. Views do not declare their
> variables, since a ref's type carries its open inputs and a schema states
> them as field arguments. Relay's fragments are on the consumer's side, so
> their counterpart is a driver's demand, such as a selection. Variables in
> selections, filling the inputs of the refs they select, are to be designed
> with the query contract:
>
> ```ts
> select<typeof data.chat>()({
>   messages: withArgs({ first: variable("pageSize") }),
> });
> ```

## Schemas

A [schema](codec.md#schemas) can make the inputs a view leaves open part of its
contract. Under a GraphQL schema, each field with arguments is a ref whose open
inputs are exactly the field's arguments, and generated types say so:

```graphql
type Chat {
  id: ID!
  messages(first: Int!, after: String): MessageConnection!
}
```

```ts
type Chat = {
  id: string;
  messages: RefTo<MessageConnection, { first: number; after: string | null }>;
};

export const chat = view({
  schema: ChatSchema,
  resolve: ({ id }, { ref, input }) => ({
    id,
    messages: ref(chatMessages, {
      chatId: id,
      first: input("first"),
      after: input("after"),
    }),
  }),
});
```

The view fails to compile if it opens an input the field does not have, such as
a misspelled `input("frist")`, or places an input where its values do not fit,
such as `after` where only a string fits. A schema-aware codec checks bound
values against the argument definitions at runtime.

An argument with a default in the schema, such as `first: Int = 20`, is optional
in the generated type, and the driver supplies its default as GraphQL does, so
the view need not repeat it.

A field with arguments is a ref, so it resolves as an instance of its own, even
when its value is a scalar, such as `avatarUrl(size: Int): String`. The root
type of a GraphQL schema is a view without arguments whose fields are refs, so
a query's root fields take their arguments as open inputs, like any other.

## Encoding

The session's [codec](codec.md) encodes an open input within the arguments as
a placeholder no data can be mistaken for, together with its name and the view
that left it open, so a template crosses a boundary or is persisted like any
other ref, and is bound on the other side. Binding needs the codec too, since a
bound ref's arguments are keyed under it.

Across sessions, an answer holds its templates encoded, and the asking session
binds them. The values a query supplies to a [remote store](federation.md) are
sent with the query.

> **Open.** Inputs opened outside views, such as in action refs an application
> makes itself, have no view to group their values by.
