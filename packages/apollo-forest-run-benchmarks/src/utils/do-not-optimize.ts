const log = (() => {
  return globalThis.console.log;
})();

const $ = {
  _: null,
  __() {
    return log($._);
  },
};
export function do_not_optimize(v: any) {
  $._ = v;
}
