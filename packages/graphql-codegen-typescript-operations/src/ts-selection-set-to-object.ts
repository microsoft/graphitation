import { SelectionSetToObject as CodegenSelectionSetToObject } from "@graphql-codegen/visitor-plugin-common";
import {
  FieldNode,
  FragmentSpreadNode,
  GraphQLError,
  GraphQLNamedType,
  InlineFragmentNode,
  Kind,
  SelectionNode,
  SelectionSetNode,
} from "graphql";

export class SelectionSetToObject extends CodegenSelectionSetToObject {
  public createNext(
    parentSchemaType: GraphQLNamedType,
    selectionSet: SelectionSetNode,
  ): SelectionSetToObject {
    return new SelectionSetToObject(
      this._processor,
      this._scalars,
      this._schema,
      this._convertName.bind(this),
      this._getFragmentSuffix.bind(this),
      this._loadedFragments,
      this._config,
      parentSchemaType,
      selectionSet,
    );
  }

  protected flattenSelectionSet(
    selections: ReadonlyArray<SelectionNode>,
  ): Map<string, Array<SelectionNode | string>> {
    const selectionNodesByTypeName = new Map<
      string,
      Array<SelectionNode | string>
    >();
    const inlineFragmentSelections: InlineFragmentNode[] = [];
    const fieldNodes: FieldNode[] = [];
    const fragmentSpreads: FragmentSpreadNode[] = [];

    for (const selection of selections) {
      const hasMaskDirective = selection.directives?.some(
        (value) => value.name.value === "mask",
      );

      if (hasMaskDirective) {
        if (selection.kind === Kind.FRAGMENT_SPREAD) {
          break;
        } else {
          throw new GraphQLError(
            `Only Fragment spread can use @mask directive`,
            selection,
          );
        }
      }

      switch (selection.kind) {
        case Kind.FIELD:
          fieldNodes.push(selection);
          break;
        case Kind.INLINE_FRAGMENT:
          inlineFragmentSelections.push(selection);
          break;
        case Kind.FRAGMENT_SPREAD:
          fragmentSpreads.push(selection);
          break;
      }
    }

    if (fieldNodes.length) {
      inlineFragmentSelections.push(
        this._createInlineFragmentForFieldNodes(
          this._parentSchemaType as GraphQLNamedType,
          fieldNodes,
        ),
      );
    }

    this._collectInlineFragments(
      this._parentSchemaType as GraphQLNamedType,
      inlineFragmentSelections,
      selectionNodesByTypeName,
    );
    const fragmentsUsage = this.buildFragmentSpreadsUsage(fragmentSpreads);

    Object.keys(fragmentsUsage).forEach((typeName) => {
      this._appendToTypeMapLocal(
        selectionNodesByTypeName,
        typeName,
        fragmentsUsage[typeName],
      );
    });

    return selectionNodesByTypeName;
  }

  private _appendToTypeMapLocal<T = SelectionNode | string>(
    types: Map<string, Array<T>>,
    typeName: string,
    nodes: Array<T>,
  ): void {
    if (!types.has(typeName)) {
      types.set(typeName, []);
    }

    if (nodes && nodes.length > 0) {
      types.get(typeName)?.push(...nodes);
    }
  }
}
