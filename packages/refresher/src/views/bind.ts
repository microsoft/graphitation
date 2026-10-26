/**
 * Binding: a template's open inputs replaced by the values given, its arguments captured
 * again by the codec, as if a view had made the ref with them. See
 * docs/architecture/variables.md.
 */
import type { AnyActionRef, AnyRef, BindFn } from "../api.core";
import type { Codec } from "../api.codec";
import { bindArgs } from "./input";
import { createActionRef, createRef, isViewRef } from "./ref";

/** Binds refs of either kind, capturing their arguments with `codec`. */
export function createBind(codec: Codec): BindFn {
  function bind(
    ref: AnyRef | AnyActionRef,
    values?: object,
  ): AnyRef | AnyActionRef {
    const args = bindArgs(ref.args, values);
    if (isViewRef(ref)) {
      // A ref the runtime made keyed its instance when it left no input open.
      if (args === ref.args && ref.instanceId !== undefined) return ref;
      const captured = codec.captureArgs(ref.view, args);
      return createRef(
        ref.view,
        captured,
        ref.meta,
        codec.instanceKey(ref.view, captured),
      );
    }
    if (args === ref.args) return ref;
    const action = ref.action;
    const captured = codec.captureActionArgs(action, args);
    codec.actionArgsKey(action, captured);
    return createActionRef(action, captured, ref.meta);
  }
  return bind as BindFn;
}
