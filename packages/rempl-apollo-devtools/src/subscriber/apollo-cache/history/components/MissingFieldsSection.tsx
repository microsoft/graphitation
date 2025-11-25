import React, { useState, useMemo } from "react";
import { Text, Tooltip, mergeClasses } from "@fluentui/react-components";
import { Warning16Filled, ChevronRight20Regular } from "@fluentui/react-icons";
import { MissingFieldItem } from "./MissingFieldItem";
import { useHistoryDetailsStyles } from "../HistoryDetails.styles";
import type { MissingFieldsSerialized } from "@graphitation/apollo-forest-run";

type MissingFieldInfo = MissingFieldsSerialized[number];

interface MissingFieldsSectionProps {
  missingFields: MissingFieldInfo[];
}

export const MissingFieldsSection: React.FC<MissingFieldsSectionProps> = ({
  missingFields,
}) => {
  const classes = useHistoryDetailsStyles();
  const [isExpanded, setIsExpanded] = useState(true);

  const missingFieldsCount = useMemo(() => {
    return missingFields.reduce((acc, item) => acc + item.fields.length, 0);
  }, [missingFields]);

  const missingObjectsCount = missingFields.length;

  return (
    <div className={classes.warningBanner} role="alert">
      <button
        type="button"
        className={classes.warningBannerToggle}
        onClick={() => setIsExpanded((prev) => !prev)}
        aria-expanded={isExpanded}
      >
        <div className={classes.warningBannerHeader}>
          <div className={classes.warningBannerHeaderLeft}>
            <Warning16Filled className={classes.warningIcon} />
            <Tooltip
              content="If an operation reads missing data it will trigger a refetch"
              relationship="description"
            >
              <Text weight="semibold">
                {missingFieldsCount} missing field
                {missingFieldsCount === 1 ? "" : "s"} across{" "}
                {missingObjectsCount} object
                {missingObjectsCount === 1 ? "" : "s"}
              </Text>
            </Tooltip>
          </div>
          <ChevronRight20Regular
            className={mergeClasses(
              classes.warningChevron,
              isExpanded && classes.warningChevronExpanded,
            )}
          />
        </div>
      </button>

      {isExpanded && (
        <div className={classes.warningBannerContent}>
          <div className={classes.missingFieldsSection}>
            {missingFields.map((missing, idx) => (
              <MissingFieldItem key={idx} missing={missing} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
