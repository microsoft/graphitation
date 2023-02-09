import * as React from "react";
import { IVerboseOperation } from "apollo-inspector";
import { useStyles } from "./verbose-operations-list-view-styles";
import { VerboseOperationView } from "./verbose-operation-view";
import { VerboseOperationsListView } from "./verbose-operations-list-view";
import { IReducerAction } from "../operations-tracker-body/operations-tracker-body.interface";

export interface IVerboseOperationsContainerProps {
  operations: IVerboseOperation[] | null;
  filter: string;
  dispatchOperationsCount: React.Dispatch<IReducerAction>;
}

export const VerboseOperationsContainer = (
  props: IVerboseOperationsContainerProps,
) => {
  const { operations, filter, dispatchOperationsCount } = props;
  const [selectedOperation, setSelectedOperation] = React.useState(
    props.operations?.[0],
  );
  const classes = useStyles();

  return (
    <div className={classes.root}>
      <div className={classes.operations}>
        <VerboseOperationsListView
          key={"VerboseOperationsListView"}
          operations={operations}
          filter={filter}
          setSelectedOperation={setSelectedOperation}
          selectedOperation={selectedOperation}
          dispatchOperationsCount={dispatchOperationsCount}
        />
        <VerboseOperationView
          key={"VerboseOperationView"}
          operation={selectedOperation}
        />
      </div>
    </div>
  );
};
