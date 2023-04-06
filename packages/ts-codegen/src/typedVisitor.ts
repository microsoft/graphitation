import { ASTNode, visit as graphQLJsVisit } from "graphql";

/**
 * Hack GraphQL Visitor to have better type safety.
 *
 * You can provide type that defines how reducer of visitor converts type (becomes return type
 * of leave) and how are fields converted (becomes fields on the node).
 */

export type ReducerResultMap<T> = {
  [NodeT in ASTNode as NodeT["kind"]]?: T | T[] | null;
};

export type ReducerFieldMap<T> = {
  [NodeT in ASTNode as NodeT["kind"]]?: {
    [K in keyof NodeT]?: T | T[] | null;
  };
};

export declare type ASTReducer<
  T,
  TR extends ReducerResultMap<T>,
  TRF extends ReducerFieldMap<T>,
> = {
  readonly [NodeT in ASTNode as NodeT["kind"]]?: {
    readonly enter?: ASTVisitFn<NodeT>;
    readonly leave: ASTReducerFn<NodeT, TR[NodeT["kind"]], TRF[NodeT["kind"]]>;
  };
};

declare type ASTReducerFn<
  TReducedNode extends ASTNode,
  TResult,
  TReducerMap,
> = (
  /** The current node being visiting. */
  node: {
    [K in keyof TReducedNode]: ReducedField<
      TReducedNode[K],
      TReducerMap extends undefined
        ? undefined
        : K extends keyof TReducerMap
        ? TReducerMap[K] extends undefined
          ? undefined
          : TReducerMap[K]
        : undefined
    >;
  },
  /** The index or key to this node from the parent node or Array. */
  key: string | number | undefined,
  /** The parent immediately above this node, which may be an Array. */
  parent: ASTNode | ReadonlyArray<ASTNode> | undefined,
  /** The key path to get to this node from the root node. */
  path: ReadonlyArray<string | number>,
  /**
   * All nodes and Arrays visited before reaching parent of this node.
   * These correspond to array indices in `path`.
   * Note: ancestors includes arrays which contain the parent of visited node.
   */
  ancestors: ReadonlyArray<ASTNode | ReadonlyArray<ASTNode>>,
) => TResult;
declare type ReducedField<T, R> = R extends undefined
  ? T
  : T extends null | undefined
  ? T
  : T extends ReadonlyArray<any>
  ? ReadonlyArray<R>
  : R;
export declare type ASTVisitFn<TVisitedNode extends ASTNode> = (
  /** The current node being visiting. */
  node: TVisitedNode,
  /** The index or key to this node from the parent node or Array. */
  key: string | number | undefined,
  /** The parent immediately above this node, which may be an Array. */
  parent: ASTNode | ReadonlyArray<ASTNode> | undefined,
  /** The key path to get to this node from the root node. */
  path: ReadonlyArray<string | number>,
  /**
   * All nodes and Arrays visited before reaching parent of this node.
   * These correspond to array indices in `path`.
   * Note: ancestors includes arrays which contain the parent of visited node.
   */
  ancestors: ReadonlyArray<ASTNode | ReadonlyArray<ASTNode>>,
) => any;

export function visit<T, TR, TTR>(
  root: ASTNode,
  visitor: ASTReducer<T, TR, TTR>,
): T {
  return graphQLJsVisit(root, visitor as any);
}
