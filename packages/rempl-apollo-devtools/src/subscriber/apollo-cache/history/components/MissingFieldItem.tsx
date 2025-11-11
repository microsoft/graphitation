import React from "react";
import { Text, Tag } from "@fluentui/react-components";
import type { MissingFieldInfo } from "../../../../history/types";
import { useMissingFieldItemStyles } from "./MissingFieldItem.styles";

export interface MissingFieldItemProps {
  missing: MissingFieldInfo;
}

export const MissingFieldItem: React.FC<MissingFieldItemProps> = ({
  missing,
}) => {
  const classes = useMissingFieldItemStyles();

  return (
    <div className={classes.container}>
      <Text className={classes.identifier}>{missing.objectIdentifier}</Text>
      <div className={classes.fieldsContainer}>
        {missing.fields.map((field, idx) => (
          <Tag key={idx} size="small" appearance="filled">
            {field.name}
          </Tag>
        ))}
      </div>
    </div>
  );
};
