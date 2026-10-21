/**
 * View, store view and pin definitions. A definition is the frozen object `view`,
 * `storeView` or `pin` returns: what `View` describes, plus its internals under `__internals`.
 */
import type {
  AccessConfig,
  AnyView,
  PinFn,
  PromiseOrValue,
  ResolveContext,
  Revision,
  StoreName,
  ViewFn,
  ViewSchema,
} from "../api.core";
import type {
  AnnotateFn,
  StoreChange,
  StoreViewContext,
  StoreViewFn,
} from "../api.stores";
import { viewError } from "../errors";

/** The internals of a view `view` returned. */
export type DerivedViewInternals = {
  readonly kind: "derived";
  readonly resolve: (args: unknown, context: ResolveContext) => unknown;
};

/** The internals of a view `storeView` returned: exactly one of `resolve` and `resolveBatch`. */
export type StoreViewInternals = {
  readonly kind: "store";
  readonly store: StoreName;
  readonly matches: (
    args: unknown,
    change: StoreChange,
    footprint: unknown,
  ) => boolean;
  readonly resolve:
    | ((args: unknown, context: StoreViewContext) => unknown)
    | undefined;
  readonly resolveBatch:
    | ((
        args: readonly unknown[],
        context: StoreViewContext,
      ) => PromiseOrValue<readonly unknown[]>)
    | undefined;
};

/** The internals of a pin `pin` returned: runs as a derived view, answering refs to `target`. */
export type PinInternals = {
  readonly kind: "pin";
  readonly target: AnyView;
  readonly resolve: (args: unknown, context: ResolveContext) => unknown;
};

export type ViewInternals =
  | DerivedViewInternals
  | StoreViewInternals
  | PinInternals;

/** What runs `view`; none for a view still to be linked. */
export function internalsOf(view: AnyView): ViewInternals | undefined {
  return (view as { readonly __internals?: ViewInternals }).__internals;
}

type Declaration = {
  readonly schema?: ViewSchema | undefined;
  readonly name?: string | undefined;
  readonly id?: string | undefined;
  readonly access?: Partial<AccessConfig> | undefined;
};

type Definition = { -readonly [K in keyof AnyView]: AnyView[K] } & {
  readonly __internals: ViewInternals;
};

/** What every definition carries, its access settled by the defaults for its kind. */
function definitionOf(
  options: Declaration,
  defaults: AccessConfig,
  internals: ViewInternals,
): Definition {
  const definition: Definition = {
    access: accessOf(options.access, defaults),
    __internals: Object.freeze(internals),
  };
  if (options.schema !== undefined) definition.schema = options.schema;
  if (options.name !== undefined) definition.name = options.name;
  if (options.id !== undefined) definition.id = options.id;
  return definition;
}

function accessOf(
  declared: Partial<AccessConfig> | undefined,
  defaults: AccessConfig,
): AccessConfig {
  return Object.freeze({
    readable: declared?.readable ?? defaults.readable,
    referenceable: declared?.referenceable ?? defaults.referenceable,
    queryable: declared?.queryable ?? defaults.queryable,
  });
}

const VIEW_ACCESS: AccessConfig = {
  readable: false,
  referenceable: true,
  queryable: false,
};

const STORE_VIEW_ACCESS: AccessConfig = {
  readable: true,
  referenceable: false,
  queryable: false,
};

type ViewDeclaration = Declaration & {
  readonly deterministic?: boolean | undefined;
  readonly memo?: boolean | undefined;
  readonly resolve: (args: unknown, context: ResolveContext) => unknown;
};

function defineView(options: ViewDeclaration): AnyView {
  const internals: DerivedViewInternals = {
    kind: "derived",
    resolve: options.resolve,
  };
  const definition = definitionOf(options, VIEW_ACCESS, internals);
  if (options.deterministic !== undefined)
    definition.deterministic = options.deterministic;
  if (options.memo !== undefined) definition.memo = options.memo;
  return Object.freeze(definition);
}

/** Declares a view. See `ViewFn`. */
export const view: ViewFn = defineView as unknown as ViewFn;

type PinDeclaration = Declaration & {
  readonly target: AnyView;
  readonly deterministic?: boolean | undefined;
  readonly resolve: (args: unknown, context: ResolveContext) => unknown;
};

function definePin(options: PinDeclaration): AnyView {
  const target = options.target;
  if (internalsOf(target)?.kind === "pin") {
    throw viewError({
      code: "PIN_TARGET",
      message: `The target of a pin is a view, never a pin: ${
        target.name ?? "a pin"
      }`,
      ...(target.id === undefined ? {} : { view: target.id }),
      ...(options.name === undefined ? {} : { viewName: options.name }),
    });
  }
  const internals: PinInternals = {
    kind: "pin",
    target,
    resolve: options.resolve,
  };
  const access = { ...options.access, readable: false };
  const definition = definitionOf(
    { ...options, access },
    VIEW_ACCESS,
    internals,
  );
  if (options.deterministic !== undefined)
    definition.deterministic = options.deterministic;
  return Object.freeze(Object.assign(definition, { target }));
}

/** Declares a pin. See `PinFn`. */
export const pin: PinFn = definePin as unknown as PinFn;

type StoreViewDeclaration = Declaration & {
  readonly store: StoreName;
  readonly matches: (
    args: unknown,
    change: StoreChange,
    footprint: unknown,
  ) => boolean;
  readonly resolve?: (args: unknown, context: StoreViewContext) => unknown;
  readonly resolveBatch?: (
    args: readonly unknown[],
    context: StoreViewContext,
  ) => PromiseOrValue<readonly unknown[]>;
};

function defineStoreView(options: StoreViewDeclaration): AnyView {
  const internals: StoreViewInternals = {
    kind: "store",
    store: options.store,
    matches: options.matches,
    resolve: options.resolve,
    resolveBatch:
      options.resolve === undefined ? options.resolveBatch : undefined,
  };
  return Object.freeze(definitionOf(options, STORE_VIEW_ACCESS, internals));
}

/** Declares a store view. See `StoreViewFn`. */
export const storeView: StoreViewFn = defineStoreView as unknown as StoreViewFn;

// Annotated answers

const ANNOTATED: unique symbol = Symbol("refresher.annotated");

export type Annotation = {
  readonly [ANNOTATED]: true;
  readonly data: unknown;
  readonly revision: Revision | undefined;
  readonly footprint: unknown;
};

function annotateAnswer(args: {
  readonly data: unknown;
  readonly revision?: Revision;
  readonly footprint?: unknown;
}): Annotation {
  return {
    [ANNOTATED]: true,
    data: args.data,
    revision: args.revision,
    footprint: args.footprint,
  };
}

/** `StoreViewContext.annotate`: one function for every store and read. */
export const annotate: AnnotateFn = annotateAnswer as unknown as AnnotateFn;

/** The annotation a store view's answer is wrapped in, if any. */
export function annotationOf(answer: unknown): Annotation | undefined {
  return typeof answer === "object" && answer !== null && ANNOTATED in answer
    ? (answer as Annotation)
    : undefined;
}
