import React, { createRef, useEffect } from "react";
import { dialogStyles } from "./activity-dialog.styles";
import { Text, Headline, Button } from "@fluentui/react-components";
import { Dismiss20Regular } from "@fluentui/react-icons";
import { RecentActivityRaw, WatchedQuery, Mutation } from "../../types";

interface ActivityDialogProps {
  value: { isMutation: boolean; __activity_type: string } & RecentActivityRaw;
  onClose: () => void;
}

export const ActivityDialog = React.memo(
  ({ value, onClose }: ActivityDialogProps) => {
    const classes = dialogStyles();
    const closeIcon = createRef<HTMLButtonElement>();

    useEffect(() => {
      closeIcon?.current?.focus();
    });

    return (
      <div className={classes.root} onClick={() => onClose()}>
        <div
          className={classes.dialogContainer}
          onClick={(e) => {
            e.stopPropagation();
          }}
        >
          <div className={classes.header}>
            <Headline>{`${value.data?.name} (${
              value.isMutation ? "Mutation" : "Watched Query"
            })`}</Headline>
            <Button
              appearance="transparent"
              ref={closeIcon}
              tabIndex={0}
              onClick={() => onClose()}
              className={classes.closeButton}
              icon={<Dismiss20Regular />}
            />
          </div>

          <div className={classes.details}>
            <div>
              <Text weight="semibold">
                {value.isMutation ? "Mutation String" : "Query String"}
              </Text>
              <div className={classes.codeBox} style={{ fontSize: "12px" }}>
                <pre>
                  <code>
                    <p>
                      {value.isMutation
                        ? (value.data as Mutation)?.mutationString
                        : (value.data as WatchedQuery)?.queryString}
                    </p>
                  </code>
                </pre>
              </div>
            </div>
            <div>
              <Text weight="semibold">Variables</Text>
              <div className={classes.codeBox}>
                <pre>
                  <code>
                    <p>{JSON.stringify(value.data?.variables)}</p>
                  </code>
                </pre>
              </div>
            </div>
            {value.data?.errorMessage && (
              <div>
                <Text weight="semibold">Error</Text>
                <div className={classes.codeBox}>
                  <pre>
                    <code>
                      <p>{value.data?.errorMessage}</p>
                    </code>
                  </pre>
                </div>
              </div>
            )}
            {!value.isMutation && (value.data as WatchedQuery)?.cachedData && (
              <div>
                <Text weight="semibold">Latest data from the cache</Text>
                <div className={classes.codeBox}>
                  <pre>
                    <code>
                      <p>
                        {JSON.stringify(
                          (value.data as WatchedQuery)?.cachedData,
                          null,
                          2,
                        )}
                      </p>
                    </code>
                  </pre>
                </div>
              </div>
            )}
            {!value.isMutation && (value.data as WatchedQuery)?.networkData && (
              <div>
                <Text weight="semibold">Network Data</Text>
                <div className={classes.codeBox}>
                  <pre>
                    <code>
                      <p>
                        {JSON.stringify(
                          (value.data as WatchedQuery)?.networkData,
                          null,
                          2,
                        )}
                      </p>
                    </code>
                  </pre>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  },
);
