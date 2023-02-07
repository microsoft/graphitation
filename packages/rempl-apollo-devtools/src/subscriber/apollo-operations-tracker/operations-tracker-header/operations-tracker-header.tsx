import React from "react";
import { Button } from "@fluentui/react-components";
import { Info20Regular } from "@fluentui/react-icons";
import { useStyles } from "./operations-tracker-header-styles";
import { Search } from "../../../components";
import debounce from "lodash.debounce";

export interface IOperationsTrackerHeaderProps {
  setOpenDescription: React.Dispatch<React.SetStateAction<boolean>>;
  openDescription: boolean;
  toggleRecording: () => void;
  isRecording: boolean;
  setFilter: React.Dispatch<React.SetStateAction<string>>;
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
    setFilter,
  } = props;

  const debouncedFilter = React.useCallback(
    debounce((e: React.SyntheticEvent) => {
      const input = e.target as HTMLInputElement;
      setFilter(input.value);
    }, 200),
    [setFilter],
  );
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
        <div>
          <Search onSearchChange={debouncedFilter} />
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
