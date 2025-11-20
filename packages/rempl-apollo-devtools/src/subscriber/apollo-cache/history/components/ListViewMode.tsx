import React from "react";
import { Text, tokens } from "@fluentui/react-components";
import type { ListItemChange } from "../../../../history/types";
import {
  getListItemChangeDescription,
  formatValueForDisplay,
} from "./arrayDiffUtils";
import { useArrayDiffViewerStyles } from "../ArrayDiffViewer.styles";

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
                {formatValueForDisplay(change.data)}
              </pre>
            )}
          </div>
        );
      })}
    </div>
  );
};
