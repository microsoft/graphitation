const print = (() => {
  if (globalThis.console?.log)
    return globalThis.console.log.bind(globalThis.console);
  if (typeof globalThis.print === "function" && !globalThis.document)
    return globalThis.print.bind(globalThis);
  return () => {}; // safe no-op if no print available
})();

// Shared sink on the global object so it's observable across modules/realms.
const DO_NOT_OPTIMIZE_SINK = (() => {
  const key = "__do_not_optimize_sink__";
  return ((globalThis as any)[key] ??= {
    _: null,
    __() {
      return print(this._);
    },
  });
})();

export function do_not_optimize(v: any) {
  DO_NOT_OPTIMIZE_SINK._ = v;
}

// Optional helper to "consume" the value, if you want to force a read side effect.
// Usage: do_not_optimize(x); do_not_optimize_consume();
export function do_not_optimize_consume() {
  return DO_NOT_OPTIMIZE_SINK.__();
}
