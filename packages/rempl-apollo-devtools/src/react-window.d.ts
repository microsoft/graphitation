declare module "react-window" {
  import * as React from "react";

  export interface ListChildComponentProps {
    index: number;
    style: React.CSSProperties;
  }

  export interface FixedSizeListProps {
    children: React.ComponentType<ListChildComponentProps>;
    height: number;
    itemCount: number;
    itemSize: number;
    width: string | number;
    overscanCount?: number;
    ref?: React.Ref<any>;
  }

  export class FixedSizeList extends React.Component<FixedSizeListProps> {
    scrollToItem(index: number, align?: string): void;
  }

  export interface VariableSizeListProps {
    children: React.ComponentType<ListChildComponentProps>;
    height: number;
    itemCount: number;
    itemSize: (index: number) => number;
    width: string | number;
    overscanCount?: number;
    ref?: React.Ref<any>;
  }

  export class VariableSizeList extends React.Component<VariableSizeListProps> {
    scrollToItem(index: number, align?: string): void;
  }
}
