import React from "react";
import { Text, Tag, tokens } from "@fluentui/react-components";
import type { MissingFieldsSerialized } from "@graphitation/apollo-forest-run";
import { useMissingFieldItemStyles } from "./MissingFieldItem.styles";

type MissingFieldInfo = MissingFieldsSerialized[number];

export interface MissingFieldItemProps {
  missing: MissingFieldInfo;
}

export const MissingFieldItem: React.FC<MissingFieldItemProps> = ({
  missing,
}) => {
  const classes = useMissingFieldItemStyles();
  const object = missing.object as any;
  const identifier =
    typeof object === "string"
      ? object
      : object.__ref ||
        (object.id ? `${object.__typename}:${object.id}` : "Unknown Object");

  return (
    <div className={classes.container}>
      <Text className={classes.identifier}>{identifier}</Text>
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
