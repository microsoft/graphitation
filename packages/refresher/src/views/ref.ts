/**
 * The runtime shape of a ref: a frozen record holding the definition or action, the
 * arguments as captured and the meta, tagged with a symbol the codecs recognize. A symbol
 * survives no JSON, so data decoded from elsewhere never passes for a ref.
 */
import type {
  Action,
  ActionArgsOf,
  ActionRef,
  AnyActionRef,
  AnyRef,
  AnyView,
  ArgsOf,
  RefFor,
  RefMeta,
} from "../api.core";

export const REF_TAG: symbol = Symbol.for("refresher.ref");

/**
 * A ref to an instance of `view`, holding `args` as given: callers pass arguments the
 * codec has already captured.
 */
export function createRef<V extends AnyView>(
  view: V,
  args: ArgsOf<V>,
  meta?: RefMeta,
): RefFor<V> {
  const ref: RefFor<V> & { readonly $$typeof: symbol } = Object.freeze({
    $$typeof: REF_TAG,
    view,
    args,
    meta,
  });
  return ref;
}

/** An action ref, holding `args` as given: callers pass arguments the codec has already captured. */
export function createActionRef<A extends Action>(
  action: A,
  args: ActionArgsOf<A>,
  meta?: RefMeta,
): ActionRef<A> {
  const ref: ActionRef<A> & { readonly $$typeof: symbol } = Object.freeze({
    $$typeof: REF_TAG,
    action,
    args,
    meta,
  });
  return ref;
}

/** Whether `value` is a ref of either kind. */
export function isRef(value: unknown): value is AnyRef | AnyActionRef {
  return (
    typeof value === "object" &&
    value !== null &&
    Reflect.get(value, "$$typeof") === REF_TAG
  );
}

/** Whether `value` is a view ref. */
export function isViewRef(value: unknown): value is AnyRef {
  return isRef(value) && Object.hasOwn(value, "view");
}

/** Whether `value` is an action ref. */
export function isActionRef(value: unknown): value is AnyActionRef {
  return isRef(value) && Object.hasOwn(value, "action");
}
