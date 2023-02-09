import React from "react";
import { Button, mergeClasses } from "@fluentui/react-components";
import { Info20Regular } from "@fluentui/react-icons";
import { useStyles } from "./operations-tracker-container-styles";

export interface IOperationsTrackerHeaderProps {
  setOpenDescription: React.Dispatch<React.SetStateAction<boolean>>;
  openDescription: boolean;
  toggleRecording: () => void;
  isRecording: boolean;
}

export const OperationsTrackerHeader = (
  props: IOperationsTrackerHeaderProps,
) => {
  const classes = useStyles();
  const {
    isRecording,
    openDescription,
    setOpenDescription,
    toggleRecording,
  } = props;
  return (
    <>
      <div className={classes.header}>
        <div>
          <Button
            title="Information"
            tabIndex={0}
            className={classes.infoButton}
            onClick={() => setOpenDescription(!openDescription)}
          >
            <Info20Regular />
          </Button>
          <Button onClick={toggleRecording}>
            {isRecording ? "Stop recording" : "Record recent activity"}
          </Button>
        </div>
      </div>
      {openDescription && (
        <div className={classes.description}>
          It monitors changes in cache, fired mutations and
          activated/deactivated queries.
        </div>
      )}
    </>
  );
};
