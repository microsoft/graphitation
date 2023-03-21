import * as React from "react";
import { Checkbox } from "@fluentui/react-components";
import { OperationType, ResultsFrom } from "apollo-inspector";
import { useStyles } from "./filter-view.styles";

interface IFilterView {
  setFilters: (filterSet: IFilterSet | null) => void;
}

export enum OperationStatus {
  InFlight = "InFlight",
  Succeded = "Succeded",
  Failed = "Failed",
  PartialSuccess = "PartialSuccess",
  Unknown = "Unknown",
}

export interface IFilterSet {
  results: string[];
  types: string[];
  statuses: string[];
}

export const querySubTypes = [
  OperationType.CacheReadQuery,
  OperationType.CacheWriteQuery,
  OperationType.ClientReadQuery,
  OperationType.ClientWriteQuery,
];

export const fragmentSubTypes = [
  OperationType.CacheReadFragment,
  OperationType.CacheWriteFragment,
  OperationType.ClientReadFragment,
  OperationType.ClientWriteFragment,
  OperationType.Fragment,
];

export const FilterView = React.memo((props: IFilterView) => {
  const [operationTypesFilter, setOperationTypesFilter] = React.useState<
    string[]
  >([]);
  const [resultFromFilter, setResultFromFilter] = React.useState<string[]>([]);
  const [statusFilter, setStatusFilter] = React.useState<string[]>([]);
  const { setFilters } = props;
  const classes = useStyles();

  const operationTypes = useOperationTypesCheckBox({
    operationTypesFilter,
    setOperationTypesFilter,
    setFilters,
    resultFromFilter,
    statusFilter,
  });

  const onResultChange = useOnResultChange(
    resultFromFilter,
    setResultFromFilter,
    setFilters,
    operationTypesFilter,
    statusFilter,
  );
  const onStatusChange = useOnStatusChange(
    statusFilter,
    setStatusFilter,
    setFilters,
    resultFromFilter,
    operationTypesFilter,
  );

  const statues = Object.entries(OperationStatus)
    .filter((status) => status[0] !== OperationStatus.InFlight)
    .map((value, key) => {
      const checkboxValue = ((value as unknown) as Array<string>)[0];
      return (
        <Checkbox
          onChange={onStatusChange}
          value={checkboxValue}
          label={checkboxValue}
          key={key}
        />
      );
    });

  const resultsFrom = Object.entries(ResultsFrom).map((value, key) => {
    const checkboxValue = ((value as unknown) as Array<string>)[0];
    return (
      <Checkbox
        onChange={onResultChange}
        value={checkboxValue}
        label={checkboxValue}
        key={key}
      />
    );
  });
  return (
    <div className={classes.filterView}>
      <div>
        <div className={classes.filters}>
          <h3 key="operationType">{`Filters`}&nbsp;</h3>
        </div>
      </div>
      <div className={classes.type}>
        <div>
          <h5 key="operationType">{`Type`}&nbsp;</h5>
        </div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          {operationTypes}
        </div>
      </div>
      <div className={classes.operationType}>
        <div>
          <h5 key="operationType">{`Result from`}&nbsp;</h5>
        </div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          {resultsFrom}
        </div>
      </div>
      <div style={{ display: "flex", flexDirection: "column" }}>
        <div>
          <h5 key="operationType">{`Status`}&nbsp;</h5>
        </div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          {statues}
        </div>
      </div>
    </div>
  );
});

interface IUseOperationTypesCheckBoxParams {
  operationTypesFilter: string[];
  setOperationTypesFilter: React.Dispatch<React.SetStateAction<string[]>>;
  setFilters: (filterSet: IFilterSet | null) => void;
  resultFromFilter: string[];
  statusFilter: string[];
}
const useOperationTypesCheckBox = ({
  operationTypesFilter,
  setOperationTypesFilter,
  setFilters,
  resultFromFilter,
  statusFilter,
}: IUseOperationTypesCheckBoxParams) => {
  const onOperationTypeChange = React.useCallback(
    ({ target: { value } }, { checked }) => {
      let typesFilter = operationTypesFilter.concat([]);
      if (checked) {
        typesFilter.push(value);
        if (value == OperationType.Query) {
          querySubTypes.forEach((type) => {
            typesFilter.push(type);
          });

          fragmentSubTypes.forEach((type) => {
            typesFilter.push(type);
          });
        }
      } else {
        typesFilter = typesFilter.filter((x) => x !== value);

        if (value == OperationType.Query) {
          typesFilter = typesFilter.filter((x) => {
            if (x === value) {
              return x === value;
            }
            if (querySubTypes.find((type) => type === x)) {
              return false;
            }

            if (fragmentSubTypes.find((type) => type === x)) {
              return false;
            }

            return true;
          });
        }
      }
      setOperationTypesFilter(typesFilter);
      setTimeout(() => {
        setFilters({
          types: typesFilter,
          results: resultFromFilter,
          statuses: statusFilter,
        });
      }, 0);
    },
    [operationTypesFilter, setOperationTypesFilter, setFilters],
  );
  const operationTypes = React.useMemo(() => {
    return Object.entries(OperationType)
      .filter(
        (value) =>
          !querySubTypes.includes(
            ((value as unknown) as Array<string>)[0] as OperationType,
          ),
      )
      .filter(
        (value) =>
          !fragmentSubTypes.includes(
            ((value as unknown) as Array<string>)[0] as OperationType,
          ),
      )
      .map((value, key) => {
        const checkboxValue = ((value as unknown) as Array<string>)[0];
        return (
          <Checkbox
            onChange={onOperationTypeChange}
            value={checkboxValue}
            label={checkboxValue}
            key={key}
          />
        );
      });
  }, [onOperationTypeChange]);

  return operationTypes;
};

const useOnStatusChange = (
  statusFilter: string[],
  setStatusFilter: React.Dispatch<React.SetStateAction<string[]>>,
  setFilters: (filterSet: IFilterSet | null) => void,
  resultFromFilter: string[],
  operationTypesFilter: string[],
) =>
  React.useCallback(
    ({ target: { value } }, { checked }) => {
      let arr = statusFilter.concat([]);
      if (checked) {
        arr.push(value);
      } else {
        arr = arr.filter((x) => x !== value);
      }
      setStatusFilter(arr);
      setTimeout(() => {
        setFilters({
          results: resultFromFilter,
          types: operationTypesFilter,
          statuses: arr,
        });
      }, 0);
    },
    [statusFilter, setStatusFilter],
  );

const useOnResultChange = (
  resultFromFilter: string[],
  setResultFromFilter: React.Dispatch<React.SetStateAction<string[]>>,
  setFilters: (filterSet: IFilterSet | null) => void,
  operationTypesFilter: string[],
  statusFilter: string[],
) =>
  React.useCallback(
    ({ target: { value } }, { checked }) => {
      let arr = resultFromFilter.concat([]);
      if (checked) {
        arr.push(value);
      } else {
        arr = arr.filter((x) => x !== value);
      }
      setResultFromFilter(arr);
      setTimeout(() => {
        setFilters({
          results: arr,
          types: operationTypesFilter,
          statuses: statusFilter,
        });
      }, 0);
    },
    [resultFromFilter, setResultFromFilter],
  );
