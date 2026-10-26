/**
 * The runtime shape of a ref: a frozen record holding the definition or action, the
 * arguments as captured, the meta, and for a view ref the instance it names, tagged with a
 * symbol the codecs recognize. A symbol survives no JSON, so data decoded from elsewhere
 * never passes for a ref.
 */
import type {
  Action,
  AnyActionRef,
  AnyRef,
  AnyView,
  ArgsOf,
  RefFor,
  RefMeta,
  ViewInstanceId,
} from "../api.core";
import type { Codec } from "../api.codec";
import { isOpen } from "./input";

export const REF_TAG: symbol = Symbol.for("refresher.ref");

/**
 * A bound ref to an instance of `view`, holding `args` as given: callers pass arguments
 * the codec has already captured, and `instanceId`, its instance key for them.
 */
export function createRef<V extends AnyView>(
  view: V,
  args: ArgsOf<V>,
  meta: RefMeta | undefined,
  instanceId: ViewInstanceId,
): RefFor<V> {
  const ref: RefFor<V> & { readonly $$typeof: symbol } = Object.freeze({
    $$typeof: REF_TAG,
    view,
    args,
    meta,
    instanceId,
  });
  return ref;
}

/**
 * A ref to `view` with captured `args`, as a view makes one: bound, keyed by `codec`, or a
 * template when they leave an input open, which names no instance until bound.
 */
export function createAnyRef(
  codec: Codec,
  view: AnyView,
  args: unknown,
  meta: RefMeta | undefined,
): AnyRef {
  const ref: AnyRef & { readonly $$typeof: symbol } = Object.freeze({
    $$typeof: REF_TAG,
    view,
    args,
    meta,
    instanceId: isOpen(args) ? undefined : codec.instanceKey(view, args),
  });
  return ref;
}

/**
 * An action ref, holding `args` as given: callers pass arguments the codec has already
 * captured, which may leave inputs open.
 */
export function createActionRef(
  action: Action,
  args: unknown,
  meta: RefMeta | undefined,
): AnyActionRef {
  const ref: AnyActionRef & { readonly $$typeof: symbol } = Object.freeze({
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
