/**
 * The codec contract: how a runtime identifies view instances, by ids for views and
 * keys for their arguments, captures those arguments, and may
 * validate the values it publishes; and the options of the built-in JSON codec. A
 * custom codec is also where a project encodes its own conventions, such as how views
 * are named and how their arguments are keyed.
 *
 * Codec-author vocabulary, separate from the consumer vocabulary in `./api.core`. An application passes a
 * codec to a runtime without seeing these methods. A codec author implements them, for
 * example to check arguments and results against the runtime definitions in a view's
 * schema. Written in the core vocabulary, never the reverse.
 */
import type {
  AccessConfig,
  Action,
  ActionId,
  AnyRef,
  AnyView,
  ReadonlyResult,
  View,
  ViewId,
  ViewInstanceId,
} from "./api.core";

/**
 * How a runtime identifies instances, captures arguments, and checks the values it
 * publishes. A runtime uses the default codec when given none. Runtimes that exchange
 * refs, such as a federation client and its host, must use codecs that agree on view ids
 * and `argsKey`.
 *
 * View ids are part of the system's schema, as the runtime definitions a schema-aware
 * codec checks values against are, so the codec issues them. Mapping an id back to a
 * view is the runtime's linker, outside the codec.
 *
 * Every method receives the definition of the view the value belongs to. Its `schema`,
 * if declared, holds runtime definitions in the codec's own vocabulary; a codec rejects
 * one it does not recognize. The definition is also an identity a codec may key
 * per-view state by, such as how it writes keys for that view's arguments.
 *
 * A codec rejects a value by throwing an `Error` that is also a `ValueError`, with the
 * path to the offending part. The runtime reports it as the failed instance's value
 * error.
 */
export type Codec = {
  /**
   * A view's id, in a format this codec defines, stable for as long as the definition
   * lives. A view the codec has no id for gets a local one, neither portable nor durable.
   * Takes linked definitions: the runtime links an external view before naming it.
   */
  viewKey(view: AnyView): ViewId;

  /**
   * Takes a provider record or view result that the runtime is about to publish and
   * returns the value to publish. It may return its input. The hook for a schema-aware
   * codec to validate results against `view.schema`; the default codec returns its
   * input unchecked.
   */
  captureResult<Result>(
    view: View<unknown, Result, AccessConfig>,
    value: Result,
  ): Result;

  /**
   * Takes arguments that become part of an instance's identity and returns the
   * arguments to use. The hook for a schema-aware codec to validate them against
   * `view.schema`, and for any codec to freeze or copy them so that a caller mutating its
   * arguments later cannot change the instance. The default codec returns them as
   * passed, relying on their readonly types. The runtime derives the identity from what
   * this returns with `argsKey`.
   *
   * The arguments of a template hold open inputs where values go, which it keeps as they
   * are, and keys as their name, default and the view that left them open. See
   * docs/architecture/variables.md.
   */
  captureArgs<Args>(view: View<Args, unknown, AccessConfig>, args: Args): Args;

  /**
   * The identity of captured arguments within one view: for the same view, equal
   * arguments must yield the same string, and different arguments different strings.
   * Keys of different views are never compared. The runtime keys instances and caches by
   * it. The key is opaque and may hold any character: it may encode the arguments, or be
   * an alias the codec issued for them. `instanceKey` combines it with `viewKey(view)`
   * into the instance's identity. A schema-aware codec may use `view.schema` to write it, for example in the order the
   * definition declares fields. A codec rejects arguments it cannot identify with code
   * `INVALID_ARGUMENT`.
   */
  argsKey<Args>(view: View<Args, unknown, AccessConfig>, args: Args): string;

  /**
   * The identity of an instance: `viewKey(view)` and `argsKey(view, args)` combined in a
   * format this codec defines. Two instances share it exactly when they share both keys.
   * Takes captured arguments, and rejects what either key rejects. The runtime keys
   * instances, refs and caches by it; nothing may be read back from it.
   */
  instanceKey<Args>(
    view: View<Args, unknown, AccessConfig>,
    args: Args,
  ): ViewInstanceId;

  /**
   * An action's id, in a format this codec defines, stable for as long as the action
   * lives: an encoded action ref names its action by it. An action the codec has no id for
   * gets a local one, readable from its `name`, neither portable nor durable. Action ids
   * and view ids are separate: one may equal the other. A codec that cannot name an
   * action rejects it with a `RefError`.
   */
  actionKey(action: Action): ActionId;

  /**
   * Takes the arguments of an action ref about to be made and returns the arguments to
   * use, as `captureArgs` does for a view's, open inputs included. The default codec
   * returns them as passed.
   */
  captureActionArgs<Args>(action: Action, args: Args): Args;

  /**
   * The identity of captured action arguments within one action, as `argsKey` is within one
   * view: two action refs are equal when they name the same action and their arguments
   * share it. Action arguments follow the rules for view arguments, so a codec rejects
   * arguments it cannot identify with code `INVALID_ARGUMENT`.
   */
  actionArgsKey(action: Action, args: unknown): string;

  /**
   * Every ref a settled result holds, templates included, for a driver that follows them,
   * binding templates first. Refs are leaves: what
   * a ref leads to is another instance, never searched. Action refs are leaves too, and
   * never found. Equal results yield their refs in
   * the same order. A codec may also tell where each ref is. A schema-aware codec may use
   * `view.schema` to search only where refs can be. A result it cannot search, such as a
   * cyclic one, is a value error.
   */
  findRefs<Result>(
    view: View<unknown, Result, AccessConfig>,
    data: ReadonlyResult<Result>,
  ): FoundRefs;
};

/** What `Codec.findRefs` found in a result. */
export type FoundRefs = {
  /** Each ref in the result, as often as the result holds it. */
  readonly refs: readonly AnyRef[];

  /**
   * For each ref, at the same index, its path in the result: `undefined` for the result
   * itself. A codec tells the paths of all refs or of none.
   */
  readonly paths?: readonly (ResultPath | undefined)[];
};

/**
 * Where a value sits in a result, linked from the value back to the result as in
 * graphql-js: `key` is the last key or index on the way, and `prev` the path of what holds
 * it, `undefined` at the result itself. Values under one parent share its path, so a
 * search tells paths without copying them.
 */
export type ResultPath = {
  readonly prev: ResultPath | undefined;
  readonly key: string | number;
};

// The built-in JSON codec

/**
 * Options for the JSON codec, which takes arguments as JSON: null, booleans, finite
 * numbers, strings, Dates, arrays, and plain objects. A Date counts as its ISO string,
 * the form `JSON.stringify` writes, so it shares a key with that string. Properties
 * holding `undefined` are omitted. An open input counts as its name, its default and the id
 * of the view that left it open. Anything else, refs and invalid Dates included, is
 * rejected with code `INVALID_ARGUMENT`.
 */
export type JsonCodecOptions = {
  /**
   * Writes each argument key as the base64url text, without padding, of the arguments'
   * JSON with object keys in sorted order, so nothing reads arguments back from an
   * instance id. Default `false`, which writes the JSON itself. `undefined` arguments
   * are `""` either way.
   */
  readonly base64Keys?: boolean;

  /**
   * Deep-freezes the arrays and plain objects of captured arguments, so a caller that
   * mutates arguments it already passed fails at once instead of corrupting an
   * instance. Dates stay mutable, since freezing one leaves its time settable. Default
   * `false`, which leaves arguments as passed; their readonly types are the only guard.
   */
  readonly freezeArgs?: boolean;
};

/**
 * Creates the JSON codec. It names a view by its `id`, in any format, and any view
 * without one by a local id that starts with `__` and includes its `name`. It names every
 * action by a local id the same way, and keys action arguments as it keys view arguments.
 * It finds refs by searching arrays, plain objects, Maps and Sets, keys included, and tells no paths. Naming a view
 * fails with a `ViewError` for an id another view already goes by, code
 * `DUPLICATE_VIEW`. It validates
 * nothing else at runtime: results are published unchecked, and arguments are checked
 * only as far as writing their keys needs.
 */
export type CreateJsonCodecFn = (options?: JsonCodecOptions) => Codec;
