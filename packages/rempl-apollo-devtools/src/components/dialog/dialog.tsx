import React, { createRef, useEffect } from "react";
import { dialogStyles } from "./dialog.styles";
import { Text, Headline, Button } from "@fluentui/react-components";
import { CacheObjectWithSize } from "../../subscriber/apollo-cache/types";
import { Dismiss20Regular } from "@fluentui/react-icons";

interface DialogProps {
  value: CacheObjectWithSize | undefined;
  onClose: () => void;
}

export const Dialog = React.memo(({ value, onClose }: DialogProps) => {
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
          <Headline className={classes.name}>{value?.key}</Headline>
          <Button
            appearance="transparent"
            ref={closeIcon}
            tabIndex={0}
            onClick={() => onClose()}
            className={classes.closeButton}
            icon={<Dismiss20Regular />}
          />
        </div>
        {value?.valueSize && (
          <Text className={classes.description} weight="semibold">
            {value?.valueSize} B
          </Text>
        )}
        <div className={classes.contentPre}>
          <pre className={classes.preStyles}>
            <code>
              <p>{JSON.stringify(value?.value, null, 2)}</p>
            </code>
          </pre>
        </div>
      </div>
    </div>
  );
});
