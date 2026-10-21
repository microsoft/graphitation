/**
 * The core of the public contract: the vocabulary every other file speaks. Views, refs,
 * results, and errors. Implementations depend on this module, never the reverse. See
 * docs/architecture/overview.md.
 *
 * Stores are written against `./api.stores`, which depends on this vocabulary the way a
 * renderer depends on a runtime — never the other way round.
 *
 * The consumer contract file, which with `./api.stores`, `./api.codec`, `./api.execution`,
 * `./api.env` and `./stores/api.object-store` are the only place a public type may be declared. This one
 * names nothing else at all, which is what keeps the dependency one-way: a store view
 * and a runtime are written in its vocabulary, not the reverse. Together the contract
 * names nothing but itself and the host types enlisted in `./api.external`.
 */

// Notification order

/**
 * A feed's clock: every delivery carries one. A pass reads at its runtime's latest
 * revision, and every read in the pass is handed that revision.
 * A store that keeps history may read as of it; one that does not reads current state,
 * and then the revision labels the pass without describing what it read.
 */
export type Revision = number;

export type PromiseOrValue<T> = Promise<T> | T;

// Views

/**
 * One signature per view: arguments select a slice, never a result type. `answer` is
 * what its `resolve` returns: the result itself, a promise of it, or either.
 */
export type ViewSignature<
  Args = unknown,
  Result = unknown,
  Answer = PromiseOrValue<Result>,
> = {
  readonly args: Args;
  readonly result: Result;
  /** What `resolve` returns; lets `read` type a synchronous view's answer as the result itself. */
  readonly answer: Answer;
};

/** The result an answer settles to. */
export type Settled<Answer> = Answer extends Promise<infer Result>
  ? Result
  : Answer;

/**
 * Runtime definitions of a view's arguments and result, paired with their static types.
 *
 * The definitions belong to the runtime's codec: a Standard Schema validator, a
 * GraphQL type reference such as `"Chat!"`, or any other value that codec understands.
 * Nothing here interprets them. A definition may be self-contained or name a type the
 * codec already holds, and a codec rejects one it does not recognize.
 *
 * The static types travel beside the definitions, since a definition need not carry
 * them: generated code annotates a schema as `ViewSchema<ChatArgs, Chat>`, and a view
 * declared with it infers its arguments and result from that annotation.
 */
export type ViewSchema<Args = unknown, Result = unknown> = {
  /** The codec's definition of the arguments. */
  readonly args: unknown;

  /** The codec's definition of the result. */
  readonly result: unknown;

  /** Type-only carrier; never set at runtime. */
  readonly signature?: ViewSignature<Args, Result>;
};

/**
 * What a view permits a caller to do with it, at the type level: decided once per
 * definition and looked up by the gated call sites.
 *
 * One type rather than a member apiece so the settings travel as a single type
 * argument. A later access setting joins as a member here rather than as another type
 * parameter on `View` and everything that names one.
 */
export type AccessConfig = {
  /**
   * Whether `read` may inline this view, fusing it into its caller's update unit.
   * Absent, not readable. See docs/architecture/views.md#access.
   */
  readonly readable: boolean;

  /**
   * Whether `ref` may defer this view behind its own cache, update, and error
   * boundary. A ref is an address that outlives the process that minted it, so this
   * is the decision to publish one. Absent, referenceable.
   */
  readonly referenceable: boolean;

  /**
   * Whether a query may start from this view: an entry point an application or another
   * runtime asks for. Absent, not queryable.
   */
  readonly queryable: boolean;
};

/**
 * What a view that declares nothing carries.
 *
 * Fixed, not configurable. A `resolve` is written in module scope, so its `read`
 * and `ref` calls are checked long before there is a runtime to consult; a
 * per-application default would have to be a global type as well as a runtime setting,
 * and nothing could hold the two to each other. A view that wants the other answer
 * says so on the definition.
 */
export type DefaultAccess = {
  readonly readable: false;
  readonly referenceable: true;
  readonly queryable: false;
};

/** What a definition declared of its access, settling the rest by the defaults for its kind. */
export type AccessOf<
  DeclaredAccess,
  Defaults extends AccessConfig = DefaultAccess,
> = {
  readonly readable: DeclaredAccess extends {
    readonly readable: infer Permitted extends boolean;
  }
    ? Permitted
    : Defaults["readable"];
  readonly referenceable: DeclaredAccess extends {
    readonly referenceable: infer Permitted extends boolean;
  }
    ? Permitted
    : Defaults["referenceable"];
  readonly queryable: DeclaredAccess extends {
    readonly queryable: infer Permitted extends boolean;
  }
    ? Permitted
    : Defaults["queryable"];
};

/**
 * Module-scoped definition, not an execution or an instance with arguments.
 * Runtime identity is the definition object, even when signatures match.
 */
export type View<
  Args = unknown,
  Result = unknown,
  Access extends AccessConfig = DefaultAccess,
  Answer = PromiseOrValue<Result>,
> = {
  /**
   * Type-only carrier; never set at runtime.
   * Required for type inference even when no runtime schemas are supplied.
   */
  readonly signature?: ViewSignature<Args, Result, Answer>;

  /**
   * Runtime definitions for the runtime's codec. The built-in codec ignores them;
   * a schema-aware codec checks arguments and results against them.
   */
  readonly schema?: ViewSchema<Args, Result>;

  /** A label for traces, errors, and devtools; neither unique nor an identity. */
  readonly name?: string;

  /**
   * The id the view asks to go by. The runtime's codec issues the `ViewId`: the default
   * codec uses this one as it is, and a custom codec may name views its own way. Renaming
   * it breaks refs encoded with the old one.
   */
  readonly id?: string;

  /**
   * When true, equal arguments and inputs must produce equal results, so a result
   * whose inputs are unchanged may be reused instead of evaluated again. Absent, a
   * view is deterministic; declare `false` for one that is not, such as a view that
   * reads the clock. Deterministic views may only consume other deterministic views,
   * so a view that consumes a non-deterministic one must declare `false` too.
   */
  readonly deterministic?: boolean;

  /**
   * Keeps this view's instances in the runtime's view cache. Like `React.memo`, an
   * instance whose inputs are unchanged skips running `resolve`; like `useMemo`, its result is
   * kept, here keyed by arguments, shared by every caller, and outliving them. Absent, an
   * instance lives only while something holds it, and an inline read of this view counts
   * as part of its caller. Ignored on a non-deterministic view.
   *
   * TODO: likely to grow into a caching configuration.
   */
  readonly memo?: boolean;

  /**
   * What this view permits a caller to do with it, member by member; absent members
   * take the built-in default. Nested rather than flat because a property is the only
   * position a call site's literal can be inferred from, which is what lets the
   * settings travel as one type argument. See docs/architecture/views.md#access.
   */
  readonly access?: Partial<Access>;
};

export type AnyView = View<unknown, unknown, AccessConfig>;

/** A view `read` accepts. Naming an unreadable one is an error at the call site. */
export type ReadableView<Args = unknown, Result = unknown> = View<
  Args,
  Result,
  {
    readonly readable: true;
    readonly referenceable: boolean;
    readonly queryable: boolean;
  }
>;

/** A view `ref` accepts. Naming an unreferenceable one is an error at the call site. */
export type ReferenceableView<Args = unknown, Result = unknown> = View<
  Args,
  Result,
  {
    readonly readable: boolean;
    readonly referenceable: true;
    readonly queryable: boolean;
  }
>;

/** A view a query may start from. Naming an unqueryable one is an error at the call site. */
export type QueryableView<Args = unknown, Result = unknown> = View<
  Args,
  Result,
  {
    readonly readable: boolean;
    readonly referenceable: boolean;
    readonly queryable: true;
  }
>;

export type ArgsOf<V extends AnyView> = NonNullable<V["signature"]>["args"];

export type ResultOf<V extends AnyView> = NonNullable<V["signature"]>["result"];

export type AnswerOf<V extends AnyView> = NonNullable<V["signature"]>["answer"];

// Identity on the wire

/**
 * A key in a format the runtime's codec defines. Refresher compares keys for equality
 * and reads nothing else from them.
 */
export type CodecSuppliedKey = string;

/**
 * A view's id, such as `ChatRoomV1`, issued by the runtime's codec. An encoded ref names
 * its view by it, and renaming one breaks the refs encoded with the old one. A view the
 * codec has no id for gets one local to the runtime, neither portable nor durable.
 */
export type ViewId = CodecSuppliedKey;

/**
 * A view instance: the view's id and a key for its arguments, combined by the runtime's
 * codec `instanceKey`. Nothing may be read from it; what needs the arguments themselves
 * carries them. An identity is scoped to the runtime that minted it.
 */
export type ViewInstanceId = CodecSuppliedKey;

// Refs

/**
 * Defers another view instance behind a cache, update, and error boundary. Like a React
 * element, a frozen record anyone may read: the view, its arguments as captured, and the
 * meta it was made with. Make one with `ref`; `isRef` tells one from data shaped like it.
 * A ref decoded from data is linked before it reaches execution, so `view` is always a
 * definition. See `ActionRef` for the other kind of ref, which `action` makes.
 *
 * `Inputs` are the inputs its arguments leave open, by name: `{}` for a bound ref, which
 * leaves none. A ref leaving inputs open is a template, never followed itself: binding it
 * supplies them. A ref fits where its consumer supplies at least the inputs it leaves
 * open, with values they accept, so a bound ref fits anywhere and a template never fits
 * where a bound ref is required. See docs/architecture/variables.md.
 */
export type Ref<Result = unknown, Args = unknown, Inputs = {}> = {
  readonly view: View<Args, Result, AccessConfig>;
  /** Its arguments, with open inputs where a template leaves values to its consumer. */
  readonly args: ArgsLeaving<Args, Inputs>;
  readonly meta: RefMeta | undefined;
  /** Type-only carrier; never set at runtime. */
  readonly signature?: RefSignature<Inputs>;
};

/**
 * The inputs a ref leaves open: their names, which only grow where more are supplied, and
 * their values, which a supplier must give. Names are compared apart from values, since
 * inputs that all have defaults are as optional as none.
 */
type RefSignature<Inputs> = {
  readonly open: (names: { readonly [K in keyof Inputs]-?: true }) => void;
  readonly inputs: (inputs: Inputs) => void;
};

type ArgsLeaving<Args, Inputs> = [keyof Inputs] extends [never]
  ? Args
  : WithOpenInputs<Args>;

/** Arguments where any value may be an open input that fits its position instead. */
type WithOpenInputs<Args> =
  | Args
  | OpenInput<string, Args>
  | (Args extends Primitive
      ? never
      : Args extends object
      ? { readonly [K in keyof Args]: WithOpenInputs<Args[K]> }
      : never);

/** The inputs `Given` leaves open, typed by their positions in `Args`. */
type OpenInputsOf<Given, Args> = Simplify<
  [CollectInputs<Given, Args>] extends [never]
    ? {}
    : UnionToIntersection<CollectInputs<Given, Args>>
>;

type CollectInputs<Given, Args> = Given extends OpenInput<
  infer Name,
  infer Default
>
  ? [Default] extends [never]
    ? { readonly [K in Name]: Args }
    : { readonly [K in Name]?: Args }
  : Given extends Primitive
  ? never
  : Given extends readonly unknown[]
  ? CollectInputs<
      Given[number],
      Args extends readonly (infer Element)[] ? Element : never
    >
  : Given extends object
  ? {
      [K in keyof Given]-?: K extends keyof Args
        ? CollectInputs<Given[K], Args[K]>
        : never;
    }[keyof Given]
  : never;

/** Rejects keys the arguments do not have, at any depth, as an object literal would. */
type NoExtra<Given, Args> = unknown extends Args
  ? unknown
  : Given extends OpenInput | readonly unknown[] | Primitive
  ? unknown
  : Given extends object
  ? {
      readonly [K in keyof Given]: K extends keyof Args
        ? NoExtra<Given[K], Args[K]>
        : never;
    }
  : unknown;

type UnionToIntersection<U> = (
  U extends unknown ? (u: U) => void : never
) extends (i: infer I) => void
  ? I
  : never;

type Simplify<T> = { [K in keyof T]: T[K] } & {};

/**
 * What a ref carries for whoever follows it, or materializes an action ref. It leaves the
 * instance alone: refs that differ only in meta lead to the same instance.
 */
export type RefMeta = RefMetaExtensions & {
  /** What a query driver may follow the ref for, such as `"above-the-fold"`. */
  readonly tags?: readonly string[];
};

/**
 * Members drivers add to `RefMeta`. Empty here; a driver declares its own by merging into it:
 *
 * ```ts
 * declare module "@graphitation/refresher" {
 *   interface RefMetaExtensions {
 *     readonly priority?: number;
 *   }
 * }
 * ```
 */
export interface RefMetaExtensions {}

/** Any view ref, bound or a template. `Ref` alone is a bound one. */
export type AnyRef = Ref<unknown, unknown, never>;

export type RefFor<V extends AnyView> = Ref<ResultOf<V>, ArgsOf<V>>;

/** The inputs a ref of either kind leaves open, by name: `{}` for a bound one. */
export type InputsOf<R> = R extends {
  readonly signature?: { readonly inputs: (inputs: infer Inputs) => void };
}
  ? Inputs
  : never;

// Open inputs

/**
 * An input a view leaves open in the arguments of a ref or action ref, for the ref's
 * consumer to supply by `name`: `input(name)` makes one. A frozen record anyone may read,
 * tagged by `$$typeof`, which survives no JSON, so data never passes for one. Opaque to
 * the view that leaves it: the view places it but never reads its value, so its result is
 * the same whatever its consumers supply. See docs/architecture/variables.md.
 */
export type OpenInput<Name extends string = string, Default = unknown> = {
  readonly $$typeof: symbol;
  readonly name: Name;
  /** The value it takes when its consumer supplies none; absent when it has none. */
  readonly default?: Default;
  /** The view whose `resolve` left it open, which a driver groups its values by. */
  readonly view: AnyView;
};

/**
 * An open input, typed by the position it stands in. One with a default is optional to
 * its consumers; the default must fit the position, as any value would. One name used in
 * several positions takes one value for all of them.
 */
export type InputFn = {
  <const Name extends string>(name: Name): OpenInput<Name, never>;
  <const Name extends string, const Default>(
    name: Name,
    options: { readonly default: Default },
  ): OpenInput<Name, Default>;
};

/** Whether a value is an open input made by `input`; data of the same shape is not. */
export type IsOpenInputFn = (value: unknown) => value is OpenInput;

/**
 * Supplies a template's open inputs and returns the bound ref: its arguments in full,
 * captured by the runtime's codec, as if a view had made it with them. Values for inputs it
 * does not leave open are ignored; an input without a value takes its default, and one
 * without either is a value error. A ref without open inputs is returned as it is.
 */
export type BindFn = {
  <Result, Args, Inputs>(
    ref: Ref<Result, Args, Inputs>,
    ...inputs: InputsParams<Inputs>
  ): Ref<Result, Args>;
  <A extends Action, Inputs>(
    ref: ActionRef<A, Inputs>,
    ...inputs: InputsParams<Inputs>
  ): ActionRef<A>;
};

/**
 * Values for a ref's open inputs: optional when it leaves none open, or none without a default.
 * Any values, for a ref whose inputs are not known, as one found in data.
 */
type InputsParams<Inputs> = [Inputs] extends [never]
  ? [inputs?: object]
  : {} extends Inputs
  ? [inputs?: NoInfer<Inputs>]
  : [inputs: NoInfer<Inputs>];

// Actions

/**
 * Something the application performs when a UI runs it. Refresher never runs one: it builds,
 * carries, and encodes action refs, and the application's runner runs them.
 * Opaque to Refresher, but for its `name`, which labels it in traces, errors, and devtools
 * and is never its identity. Any function or object that is not a view is an action. A
 * function's first parameter types its arguments and its return type its result; how
 * other actions, such as command objects, type theirs is open. See
 * docs/architecture/actions.md.
 */
export type Action = object & {
  readonly name?: string;
  readonly access?: never;
};

/** An action's arguments: a function's first parameter, `undefined` when it takes none. */
export type ActionArgsOf<A> = A extends (...args: infer Params) => unknown
  ? Params extends readonly []
    ? undefined
    : Params[0]
  : unknown;

/** An action's result: a function's return type. What a runner does with it is its own. */
export type ActionResultOf<A> = A extends (...args: never) => infer Result
  ? Result
  : unknown;

/**
 * An action's id, issued by the runtime's codec. An encoded action ref names its action by
 * it. Mapping one back to an action belongs to the project, not to Refresher.
 */
export type ActionId = CodecSuppliedKey;

/**
 * A typed address of an action and the arguments to run it with. `action` makes one
 * as `ref` makes a ref to a view: a frozen record anyone may read, holding the action, its
 * arguments as captured, and the meta it was made with. `isRef` matches both kinds, and the
 * record tells which: a view ref names its `view`, an action ref its `action`.
 *
 * It is never evaluated or read, and creates no boundary: within a result it is a leaf,
 * part of the value of the view that returned it, so a view offers an action by returning
 * its ref and withholds it by leaving it out. No query driver follows one. Its arguments
 * follow the rules for a view's: JSON, holding no refs but external ones. Two action refs
 * are equal when they name the same action and the codec keys their arguments alike.
 *
 * `Inputs` are the inputs its arguments leave open, as on a `Ref`: the runner binds
 * them. See docs/architecture/variables.md.
 */
export type ActionRef<A extends Action, Inputs = {}> = {
  readonly action: A;
  /** Its arguments, with open inputs where a template leaves values to its runner. */
  readonly args: ArgsLeaving<ActionArgsOf<A>, Inputs>;
  readonly meta: RefMeta | undefined;
  /** Type-only carrier; never set at runtime. */
  readonly signature?: RefSignature<Inputs>;
};

/** Any action ref, bound or a template. */
export type AnyActionRef = {
  readonly action: Action;
  readonly args: unknown;
  readonly meta: RefMeta | undefined;
};

// Results

type Primitive = string | number | boolean | bigint | null | undefined;

/**
 * Native value leaves retain their methods. Dates are copied key components;
 * Blobs carry immutable binary data rather than traversable object properties.
 */
type Leaf = Primitive | Date | Blob | AnyRef | AnyActionRef;

/**
 * Cached results are shared across callers; mutation would corrupt other readers.
 * Refs of both kinds, and external refs as primitives, remain opaque leaves rather than being traversed or resolved.
 * Collection keys, values, and elements are deeply readonly too.
 */
export type ReadonlyResult<T> = T extends Leaf
  ? T
  : T extends ReadonlyMap<infer K, infer V>
  ? ReadonlyMap<ReadonlyResult<K>, ReadonlyResult<V>>
  : T extends ReadonlySet<infer V>
  ? ReadonlySet<ReadonlyResult<V>>
  : T extends object
  ? { readonly [K in keyof T]: ReadonlyResult<T[K]> }
  : T;

// Resolve

/**
 * Inlines the callee: its reads, invalidations, and failures belong to the caller,
 * and both recompute together. Use `ref` for an independent boundary.
 * The target must permit it; see docs/architecture/views.md#access.
 *
 * Answers the way the callee's `resolve` does. A callee that returns its result itself
 * answers with it; one that may return a promise may answer either way, since a cached
 * instance answers at once. See docs/architecture/views.md#synchronous-views.
 *
 * A readable view keyed by external refs, such as a remote store's, reads them: `read(view,
 * ref)`. When the view leaves its result `unknown`, the ref types it: the result of the
 * instance the ref names, its refs external in turn, and followed as the ref's query
 * followed them. See docs/architecture/federation.md#reading-external-refs.
 *
 * A view whose arguments may be `undefined` reads without them: `read(view)`.
 */
export type ReadFn = {
  <V extends ReadableView<ExternalRef>, R extends ExternalRef & ArgsOf<V>>(
    view: V,
    ref: R,
  ): ReadAnswer<
    V,
    unknown extends ResultOf<V>
      ? External<ExternalRefResult<R>, ExternalRefFollowed<R>>
      : ResultOf<V>
  >;
  <V extends ReadableView>(
    view: V,
    ...args: ArgsParams<ArgsOf<V>>
  ): ReadAnswer<V>;
};

/** What `read` answers with for a view, of `Result`. */
export type ReadAnswer<V extends AnyView, Result = ResultOf<V>> = [
  MayWait<AnswerOf<V>>,
] extends [never]
  ? ReadonlyResult<Result>
  : PromiseOrValue<ReadonlyResult<Result>>;

type MayWait<Answer> = Answer extends Promise<unknown> ? Answer : never;

/**
 * A ref to a view instance, which caches and refreshes independently of its parent.
 * Canonicalizes arguments without recording a read or running anything. The view must
 * permit it; see docs/architecture/views.md#access. Arguments that may be `undefined` may
 * be left out.
 *
 * Any argument may be left open by `input(name)`, making a template its consumer binds.
 * See docs/architecture/variables.md.
 */
export type RefFn = <
  V extends ReferenceableView,
  const Given extends WithOpenInputs<ArgsOf<V>> = ArgsOf<V>,
>(
  view: V,
  ...argsAndMeta: ArgsAndMetaParams<ArgsOf<V>, Given>
) => Ref<ResultOf<V>, ArgsOf<V>, OpenInputsOf<Given, ArgsOf<V>>>;

/**
 * An action ref: an address the application runs, never run here. Canonicalizes
 * arguments without recording a read or running anything. Arguments that may be `undefined`
 * may be left out. Any argument may be left open by `input(name)`, for the runner to
 * bind. See docs/architecture/actions.md.
 */
export type ActionRefFn = <
  A extends Action,
  const Given extends WithOpenInputs<ActionArgsOf<A>> = ActionArgsOf<A>,
>(
  action: A,
  ...argsAndMeta: ArgsAndMetaParams<ActionArgsOf<A>, Given>
) => ActionRef<A, OpenInputsOf<Given, ActionArgsOf<A>>>;

type ArgsParams<Args> = undefined extends Args ? [args?: Args] : [args: Args];

type ArgsAndMetaParams<Args, Given> = undefined extends Args
  ? [args?: Given & NoExtra<Given, Args>, meta?: RefMeta]
  : [args: Given & NoExtra<Given, Args>, meta?: RefMeta];

/**
 * Whether a value is a ref made by `ref` or `action`; data of the same shape is not.
 */
export type IsRefFn = (value: unknown) => value is AnyRef | AnyActionRef;

/** Store state is reachable only through store views; the caller is not observable. */
export type ResolveContext = {
  readonly read: ReadFn;
  readonly ref: RefFn;
  readonly action: ActionRefFn;
  readonly input: InputFn;
};

/**
 * Must be side-effect-free: no writes, network, timers, or external mutation.
 * External effects belong to the application. Determinism is separate.
 *
 * Returns the view's answer: its result itself, or a promise of it. Readers receive it
 * the same way, so a `resolve` that awaits makes its view one that may wait.
 */
export type ResolveFn<Args, Answer> = (
  args: Args,
  context: ResolveContext,
) => Answer;

// Defining a view

export type ViewOptions<
  Args,
  Result,
  Access extends AccessConfig = DefaultAccess,
  Answer extends PromiseOrValue<Result> = PromiseOrValue<Result>,
> = {
  /**
   * See `View.schema`. Its annotation supplies the view's types; without one, they are
   * inferred from `resolve` or given as explicit type arguments.
   */
  readonly schema?: ViewSchema<Args, Result>;

  /** See `View.name`. */
  readonly name?: string;

  /** See `View.id`. */
  readonly id?: string;

  /** See `View.deterministic`. */
  readonly deterministic?: boolean;

  /** See `View.memo`. */
  readonly memo?: boolean;

  /** See `View.access`. */
  readonly access?: Partial<Access>;

  readonly resolve: ResolveFn<Args, Answer>;
};

/**
 * Declaration only: no registration, resources, or reads.
 *
 * `Answer` is what `resolve` returns, and `Result` what it settles to, unless a schema
 * supplies it. Explicit type arguments therefore name the answer: `view<string, number>`
 * returns its result itself, and `view<string, Promise<number>>` may wait.
 *
 * `DeclaredAccess` is what the options object said about access, which is narrower
 * than the access it settles: absent members are what `AccessOf` fills in. It is a
 * `const` parameter because the gated call sites want `true` and `false`, not
 * `boolean`.
 */
export type ViewFn = <
  Args,
  Answer extends PromiseOrValue<unknown>,
  const DeclaredAccess extends Partial<AccessConfig> = Record<string, never>,
  Result = Settled<Answer>,
>(
  options: ViewOptions<
    Args,
    Result,
    AccessConfig,
    Answer & PromiseOrValue<Result>
  > & {
    readonly access?: DeclaredAccess;
  },
) => View<Args, Result, AccessOf<DeclaredAccess>, Answer>;

// Pins

/**
 * A view that answers with a ref to its `target`, or `null`, and whose answer a live query
 * keeps: the query asks it once and does not run it again when what it read changes, while
 * the target stays live. Another query asks again, and a one-shot query keeps nothing.
 * Never readable. See docs/architecture/pins.md.
 */
export type Pin<
  Target extends AnyView = AnyView,
  Args = unknown,
  Result = PinResult<Target>,
  Access extends PinAccess = DefaultAccess,
  Answer = PromiseOrValue<Result>,
> = View<Args, Result, Access, Answer> & {
  /** The view every ref the pin answers with leads to: a view, never a pin. */
  readonly target: Target;
};

/** What a pin to `Target` answers: a bound ref to it, or `null`. */
export type PinResult<Target extends AnyView> = Ref<
  ResultOf<Target>,
  ArgsOf<Target>
> | null;

/** The access a pin may settle: never readable. */
export type PinAccess = {
  readonly readable: false;
  readonly referenceable: boolean;
  readonly queryable: boolean;
};

export type PinOptions<
  Target extends AnyView,
  Args,
  Result,
  Access extends PinAccess = DefaultAccess,
  Answer extends PromiseOrValue<Result> = PromiseOrValue<Result>,
> = {
  /** See `Pin.target`. */
  readonly target: Target;

  /** See `View.schema`. */
  readonly schema?: ViewSchema<Args, Result>;

  /** See `View.name`. */
  readonly name?: string;

  /** See `View.id`. */
  readonly id?: string;

  /** See `View.deterministic`. */
  readonly deterministic?: boolean;

  /** See `View.access`. Never readable. */
  readonly access?: Partial<Access>;

  /**
   * As a view's `resolve`. Answers `ref(target, args)` or `null`; any other answer, a ref
   * to another view or one leaving inputs open, fails the pin.
   */
  readonly resolve: ResolveFn<Args, Answer>;
};

/**
 * Declares a pin, as `ViewFn` declares a view. Its result is the same as a view returning
 * the same refs, so turning a view into a pin changes none of its consumers; reading it is
 * a type error. A target that is itself a pin is an error, at the call site and at
 * runtime.
 */
export type PinFn = <
  Target extends AnyView & { readonly target?: never },
  Args,
  Answer extends PromiseOrValue<PinResult<Target>>,
  const DeclaredAccess extends Partial<PinAccess> = Record<string, never>,
  Result = Settled<Answer>,
>(
  options: PinOptions<
    Target,
    Args,
    Result,
    PinAccess,
    Answer & PromiseOrValue<Result>
  > & {
    readonly access?: DeclaredAccess;
  },
) => Pin<Target, Args, Result, AccessOf<DeclaredAccess>, Answer>;

// Federation

/**
 * A typed address for a view this module does not import: a `ViewId` rather
 * than a definition, carried as its `id`. Always readable, referenceable, and queryable;
 * the view it links to answers for everything else. See
 * docs/architecture/linking.md#external-views.
 */
export type ExternalView<Args = unknown, Result = unknown> = View<
  Args,
  Result,
  {
    readonly readable: true;
    readonly referenceable: true;
    readonly queryable: true;
  }
>;

export type ExternalOptions = {
  /** See `View.name`. */
  readonly name?: string;
};

/**
 * Declaration only. Linked per runtime when first used: a view the runtime's linker
 * maps `id` to runs locally, otherwise a connected runtime runs it, otherwise it fails as
 * `UNRESOLVED_VIEW`. Its answer holds external refs wherever it runs, so moving the view
 * to another runtime changes none of its readers. The signature is a type argument, so a
 * type-only import — or a written `View<Args, Result>` for a cycle — is all a declaration
 * needs. `Followed` is what its query follows; see `ExternalRef`.
 */
export type ExternalViewFn = <V extends AnyView = View, Followed = never>(
  id: ViewId,
  options?: ExternalOptions,
) => ExternalView<ArgsOf<V>, External<ResultOf<V>, Followed>>;

/**
 * A ref to an instance another runtime runs, as an external view's answer holds it: an
 * encoded ref, a string or a number in a format the two runtimes agree on. Data to the
 * runtime holding it, so it may be a view's argument or a store view's key, and equal
 * refs are `===`. A readable view keyed by external refs reads it, typically a store view
 * of the remote store it arrived through. A plain string or number is not one: only what
 * decodes another runtime's answers makes them, by a cast. See
 * docs/architecture/federation.md.
 *
 * Typed by results only, never by arguments. `Followed` is the union of results the query
 * that brought it followed refs to: `never` for a ref it did not follow, which can be
 * passed on but not read as a `FollowedRef`; `unknown` for a query that follows every
 * ref. A ref from a query that followed more fits where less is needed.
 */
export type ExternalRef<Result = unknown, Followed = never> = (
  | string
  | number
) & {
  /** Type-only carriers; never set at runtime. */
  readonly [externalRefResult]: Result;
  readonly [externalRefFollowed]: (followed: Followed) => void;
  readonly [externalRefIsFollowed]: [Followed] extends [never] ? boolean : true;
};

declare const externalRefResult: unique symbol;
declare const externalRefFollowed: unique symbol;
declare const externalRefIsFollowed: unique symbol;

/** An external ref its query followed, whatever its result: the key of a remote store's `views`. */
export type FollowedRef = ExternalRef & {
  readonly [externalRefIsFollowed]: true;
};

export type ExternalRefFor<V extends AnyView, Followed = never> = ExternalRef<
  ResultOf<V>,
  Followed
>;

type ExternalRefResult<R> = R extends {
  readonly [externalRefResult]: infer Result;
}
  ? Result
  : never;

type ExternalRefFollowed<R> = R extends {
  readonly [externalRefFollowed]: (followed: infer Followed) => void;
}
  ? Followed
  : never;

/**
 * An action ref another runtime encoded, as an external view's answer holds it: a string or
 * a number in a format the two runtimes agree on, typed by the action it names and the
 * inputs it leaves open, as the action ref it encodes is. Data to the runtime holding it, so
 * it may be an argument; unlike an external ref, it is never read. The application's runner
 * decodes and runs it, with values for its open inputs. Only what decodes another runtime's
 * answers makes one, by a cast. See docs/architecture/actions.md#encoding-and-linking.
 */
export type ExternalActionRef<A extends Action = Action, Inputs = {}> = (
  | string
  | number
) & {
  /** Type-only carriers; never set at runtime. */
  readonly [externalActionRefAction]: A;
  readonly [externalActionRefSignature]: RefSignature<Inputs>;
};

declare const externalActionRefAction: unique symbol;
declare const externalActionRefSignature: unique symbol;

/**
 * A result as another runtime answers it: every ref in it is an external ref, followed
 * when its result is in `Followed`, and every action ref an external action ref.
 */
export type External<T, Followed = never> = T extends Ref<
  infer Result,
  unknown,
  never
>
  ? [Result] extends [Followed]
    ? ExternalRef<Result, Followed>
    : ExternalRef<Result>
  : T extends AnyActionRef
  ? ExternalActionRef<T["action"], InputsOf<T>>
  : T extends Leaf
  ? T
  : T extends ReadonlyMap<infer K, infer V>
  ? ReadonlyMap<External<K, Followed>, External<V, Followed>>
  : T extends ReadonlySet<infer V>
  ? ReadonlySet<External<V, Followed>>
  : T extends object
  ? { readonly [K in keyof T]: External<T[K], Followed> }
  : T;

// Errors

/**
 * Every failure Refresher reports is data, discriminated by `kind` and grouped by the
 * entity that failed. Nothing is identified by class: `instanceof` is unreliable once an
 * application resolves two copies of the package, so narrow on `kind`, then on `code`.
 *
 * `kind` is exhaustive; `code` is a narrower diagnostic within a kind and may gain
 * members, so an unrecognised one must degrade to the kind alone.
 */
export type RefresherError =
  | StoreError
  | ViewError
  | RefError
  | ValueError
  | SessionError
  | OperationError
  | InternalError;

/** A read binding, store operation, or notification is invalid or unavailable. */
export type StoreError = {
  readonly kind: "store";
  readonly message: string;
  readonly code: string;

  /** Absent when the offending value was not a store definition at all. */
  readonly store?: StoreName;
};

/**
 * A view definition, or its id, is wrong. About the definition
 * itself, not about any one of its results.
 */
export type ViewError = {
  readonly kind: "view";
  readonly message: string;
  readonly code: string;

  /** The view's id, when the failure is about one. */
  readonly view?: ViewId;

  /** See `View.name`. */
  readonly viewName?: string;
};

/**
 * A `ref()` or `read()` call named a target it cannot reference: one that resolves to
 * nothing, or one the caller is not allowed to consume. A read is an inlined ref, so
 * both fail the same way. A target that does not permit how it was consumed is
 * reported here under `NOT_READABLE` or `NOT_REFERENCEABLE`, matching the type error
 * the same call raises.
 */
export type RefError = {
  readonly kind: "ref";
  readonly message: string;
  readonly code: string;

  /** The id the call named, when it carried one. */
  readonly view?: ViewId;

  /** The target's `View.name`, when it is known. */
  readonly viewName?: string;
};

/**
 * A failure at a known position in the result graph: a view's `resolve` threw, or a value was
 * rejected by the codec. Carried by evaluated instances; inlined
 * reads throw. Failures cross ref boundaries as data. Nulling fields, bubbling, and root
 * failure follow query-driver policy; see docs/architecture/errors.md.
 */
export type ValueError = {
  readonly kind: "value";

  readonly message: string;

  readonly path: readonly (string | number)[];

  readonly code?: string;
};

/** The runtime is unknown or disposed, or the options it was opened with are invalid. */
export type SessionError = {
  readonly kind: "session";
  readonly message: string;
  readonly code: string;
};

/**
 * A query could not start, continue, or publish: aborted, stopped, closed, or over a limit.
 */
export type OperationError = {
  readonly kind: "operation";
  readonly message: string;
  readonly code: string;
};

/**
 * An invariant of Refresher itself was violated. Nothing a caller can act on; report it
 * rather than handling it.
 */
export type InternalError = {
  readonly kind: "internal";
  readonly message: string;
  readonly code: string;
};

/** Structural narrowing for a caught value. Never `instanceof`. */
export type IsRefresherErrorFn = (value: unknown) => value is RefresherError;

/** A store's name, as `StoreChange.store` and `StoreError.store` carry it. */
export type StoreName = string;
