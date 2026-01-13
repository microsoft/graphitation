import React from "react";
import { Text, tokens } from "@fluentui/react-components";
import type { CompositeListLayoutChange as ListItemChange } from "@graphitation/apollo-forest-run";
import { getListItemChangeDescription } from "./arrayDiffUtils";
import { useArrayDiffViewerStyles } from "../ArrayDiffViewer.styles";
import { formatValue } from "../shared/diffUtils";

interface ListViewModeProps {
  itemChanges: ListItemChange[];
}

export const ListViewMode: React.FC<ListViewModeProps> = ({ itemChanges }) => {
  const classes = useArrayDiffViewerStyles();

  return (
    <div className={classes.listItemsContainer}>
      {itemChanges.map((change, index) => {
        if (!change) return null;

        return (
          <div key={index} className={classes.listItem}>
            <Text className={classes.listItemText}>
              {getListItemChangeDescription(change)}
            </Text>
            {change.data !== undefined && (
              <pre
                style={{
                  margin: "4px 0 0 0",
                  fontSize: "12px",
                  fontFamily: tokens.fontFamilyMonospace,
                }}
              >
                {formatValue(change.data)}
              </pre>
            )}
          </div>
        );
      })}
    </div>
  );
};
