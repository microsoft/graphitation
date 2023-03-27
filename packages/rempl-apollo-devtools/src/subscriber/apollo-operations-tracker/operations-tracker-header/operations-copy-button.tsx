import {
  Menu,
  MenuItem,
  MenuList,
  MenuPopover,
  MenuTrigger,
  SplitButton,
  MenuButtonProps,
  Button,
} from "@fluentui/react-components";
import { remplSubscriber } from "../../rempl";
import * as React from "react";
import { IOperationsReducerState } from "../operations-tracker-container-helper";
import { useStyles } from "./operations-copy-button-styles";
import { IDataView } from "apollo-inspector";

export interface ICopyButtonProps {
  hideCopy: boolean;
  operationsState: IOperationsReducerState;
  apolloOperationsData: IDataView | null;
}

export const CopyButton = (props: ICopyButtonProps) => {
  const classes = useStyles();
  const { operationsState, hideCopy, apolloOperationsData } = props;

  const copyAll = React.useCallback(() => {
    const ids: number[] = [];
    apolloOperationsData?.verboseOperations?.forEach((op) => {
      ids.push(op.id);
    });
    remplSubscriber.callRemote("copyOperationsData", ids);
  }, [apolloOperationsData]);

  const copyFiltered = React.useCallback(() => {
    const ids: number[] = [];
    operationsState.filteredOperations?.forEach((op) => {
      ids.push(op.id);
    });

    remplSubscriber.callRemote("copyOperationsData", ids);
  }, [operationsState]);

  const copyChecked = React.useCallback(() => {
    const ids: number[] = [];
    operationsState.checkedOperations?.forEach((op) => {
      ids.push(op.id);
    });

    remplSubscriber.callRemote("copyOperationsData", ids);
  }, [operationsState]);

  const copySelected = React.useCallback(() => {
    if (operationsState.selectedOperation?.id) {
      const ids: number[] = [operationsState.selectedOperation.id];

      remplSubscriber.callRemote("copyOperationsData", ids);
    }
  }, [operationsState]);

  const copyCache = React.useCallback(() => {
    remplSubscriber.callRemote("copyOperationsData", [-1]);
  }, [operationsState]);

  if (hideCopy) {
    return (
      <div className={classes.button}>
        <Button onClick={copyCache}>Copy Whole Apollo Cache</Button>
      </div>
    );
  }

  return (
    <div className={classes.button}>
      <Menu positioning="below-end">
        <MenuTrigger disableButtonEnhancement>
          {(triggerProps: MenuButtonProps) => (
            <SplitButton
              disabled={hideCopy}
              onClick={copyAll}
              menuButton={triggerProps}
            >
              Copy All
            </SplitButton>
          )}
        </MenuTrigger>

        <MenuPopover>
          <MenuList>
            <MenuItem onClick={copyAll}>Copy All Operations</MenuItem>
            {(operationsState.filteredOperations?.length || 0) > 0 ? (
              <MenuItem onClick={copyFiltered}>
                Copy Filtered Operations
              </MenuItem>
            ) : null}
            {(operationsState.checkedOperations?.length || 0) > 0 ? (
              <MenuItem onClick={copyChecked}>Copy Checked Operations</MenuItem>
            ) : null}
            {operationsState.selectedOperation ? (
              <MenuItem onClick={copySelected}>
                Copy currently Opened Operation
              </MenuItem>
            ) : null}
            <MenuItem onClick={copyCache}>Copy Whole Apollo Cache</MenuItem>
          </MenuList>
        </MenuPopover>
      </Menu>
    </div>
  );
};
