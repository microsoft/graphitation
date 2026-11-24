const liveSourceSymbol: unique symbol = Symbol.for(
  "@graphitation/supermassive/live-source",
);

export interface ILiveSource<T> {
  readonly [liveSourceSymbol]: true;
  read(): T;
  subscribe(invalidate: () => void): () => void;
}

export function createLiveSource<T>(
  source: Omit<ILiveSource<T>, typeof liveSourceSymbol>,
): ILiveSource<T> {
  return {
    [liveSourceSymbol]: true,
    read: () => source.read(),
    subscribe: (invalidate) => source.subscribe(invalidate),
  };
}

export function isLiveSource(value: unknown): value is ILiveSource<unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    (value as ILiveSource<unknown>)[liveSourceSymbol] === true
  );
}

export type LiveResolverResult<T> =
  | T
  | ILiveSource<T>
  | Promise<T | ILiveSource<T>>;
