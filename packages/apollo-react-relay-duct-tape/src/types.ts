export interface Variables {
  [name: string]: any;
}

export interface OperationType {
  readonly variables: Variables;
  readonly response: unknown;
  readonly rawResponse?: unknown;
}

/**
 * relay-compiler-language-typescript support for fragment references
 */

export interface _RefType<Ref extends string> {
  " $refType": Ref;
}

export interface _FragmentRefs<Refs extends string> {
  " $fragmentRefs": FragmentRefs<Refs>;
}

// This is used in the actual artifacts to define the various fragment references a container holds.
export type FragmentRefs<Refs extends string> = {
  [ref in Refs]: true;
};

// This is a utility type for converting from a data type to a fragment reference that will resolve to that data type.
export type FragmentRef<Fragment> = Fragment extends _RefType<infer U>
  ? _FragmentRefs<U>
  : never;

/**
 * react-relay DT
 */

export type FragmentReference = unknown;

export type KeyType<TData = unknown> = Readonly<{
  " $data"?: TData;
  " $fragmentRefs": FragmentReference;
}>;

export type KeyTypeData<
  TKey extends KeyType<TData>,
  TData = unknown
> = Required<TKey>[" $data"];

export type ArrayKeyType<TData = unknown> = ReadonlyArray<KeyType<
  ReadonlyArray<TData>
> | null>;
export type ArrayKeyTypeData<
  TKey extends ArrayKeyType<TData>,
  TData = unknown
> = KeyTypeData<NonNullable<TKey[number]>>;
