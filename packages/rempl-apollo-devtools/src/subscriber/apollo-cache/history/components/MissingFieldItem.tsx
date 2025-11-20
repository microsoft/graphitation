import React from "react";
import { Text, Tag, tokens } from "@fluentui/react-components";
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
          <Tag
            key={idx}
            size="small"
            appearance="outline"
            style={{
              borderColor: tokens.colorStatusWarningBorder1,
              backgroundColor: tokens.colorStatusWarningBackground2,
              color: tokens.colorStatusWarningForeground2,
            }}
          >
            {field.name}
          </Tag>
        ))}
      </div>
    </div>
  );
};
