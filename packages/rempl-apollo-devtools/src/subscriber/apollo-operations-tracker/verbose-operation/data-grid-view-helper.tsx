import * as React from "react";
import {
  TableCellLayout,
  createTableColumn,
  Text,
} from "@fluentui/react-components";
import {
  IOperationResult,
  IVerboseOperation,
  OperationType,
} from "apollo-inspector";
import { fragmentSubTypes, IFilterSet, querySubTypes } from "./filter-view";
import {
  secondsToTime,
  sizeInBytes,
} from "../utils/apollo-operations-tracker-utils";
import {
  EditRegular,
  ReadingListRegular,
  PipelineRegular,
  DatabaseLinkRegular,
  BookDatabaseRegular,
  DatabaseSearchRegular,
  DatabaseRegular,
  BookOpenRegular,
  BookLetterRegular,
} from "@fluentui/react-icons";

export type Duration = {
  totalTime: number;
};

export type Timing = {
  queuedAt: number;
  dataWrittenToCacheCompletedAt: number;
  responseReceivedFromServerAt: number;
};

export type Result = {
  size: number;
};

export type Item = {
  operationType: string;
  operationName: string;
  isActive: boolean;
  duration: Duration;
  timing: Timing;
  status: string;
  fetchPolicy: string;
  result: Result[];
  id: number;
};

export const getColumns = (
  anyOperationSelected: boolean,
  classes: Record<
    | "gridRow"
    | "gridBody"
    | "gridHeader"
    | "gridView"
    | "selectedAndFailedRow"
    | "failedRow"
    | "selectedRow"
    | "operationText",
    string
  >,
) => {
  if (anyOperationSelected) {
    return [
      createTableColumn<Item>({
        columnId: "id",
        renderHeaderCell: () => {
          return "Id";
        },
        compare: (a, b) => {
          return b.id - a.id;
        },
        renderCell: (item) => {
          return <TableCellLayout truncate>{item.id}</TableCellLayout>;
        },
      }),
      createTableColumn<Item>({
        columnId: "operationType",
        renderHeaderCell: () => {
          return "Type";
        },
        compare: (a, b) => {
          return compareString(b.operationType, a.operationType);
        },
        renderCell: (item) => {
          return (
            <TableCellLayout
              truncate
              media={getOperationIcon(item.operationType)}
            >
              {item.operationType}
            </TableCellLayout>
          );
        },
      }),
      createTableColumn<Item>({
        columnId: "operationName",
        renderHeaderCell: () => {
          return "Name";
        },
        compare: (a, b) => {
          return compareString(b.operationName, a.operationName);
        },
        renderCell: (item) => {
          return (
            <TableCellLayout truncate>
              <Text truncate wrap={false} className={classes.operationText}>
                {item.operationName}
              </Text>
            </TableCellLayout>
          );
        },
      }),
    ];
  }
  return [
    createTableColumn<Item>({
      columnId: "id",
      renderHeaderCell: () => {
        return "Id";
      },
      compare: (a, b) => {
        return b.id - a.id;
      },
      renderCell: (item) => {
        return <TableCellLayout truncate>{item.id}</TableCellLayout>;
      },
    }),
    createTableColumn<Item>({
      columnId: "operationType",
      renderHeaderCell: () => {
        return "Type";
      },
      compare: (a, b) => {
        return compareString(b.operationType, a.operationType);
      },
      renderCell: (item) => {
        return (
          <TableCellLayout
            truncate
            media={getOperationIcon(item.operationType)}
          >
            {item.operationType}
          </TableCellLayout>
        );
      },
    }),
    createTableColumn<Item>({
      columnId: "operationName",
      renderHeaderCell: () => {
        return "Name";
      },
      compare: (a, b) => {
        return compareString(b.operationName, a.operationName);
      },
      renderCell: (item) => {
        return <TableCellLayout truncate>{item.operationName}</TableCellLayout>;
      },
    }),
    createTableColumn<Item>({
      columnId: "status",
      compare: (a, b) => {
        return compareString(b.status, a.status);
      },
      renderHeaderCell: () => {
        return "Status";
      },
      renderCell: (item) => {
        return <TableCellLayout truncate>{item.status}</TableCellLayout>;
      },
    }),
    createTableColumn<Item>({
      columnId: "fetchPolicy",
      compare: (a, b) => {
        return compareString(b.fetchPolicy, a.fetchPolicy);
      },
      renderHeaderCell: () => {
        return "Fetch Policy";
      },
      renderCell: (item) => {
        return <TableCellLayout truncate>{item.fetchPolicy}</TableCellLayout>;
      },
    }),
    createTableColumn<Item>({
      columnId: "totalTime",
      compare: (a, b) => {
        return b.duration.totalTime - a.duration.totalTime;
      },
      renderHeaderCell: () => {
        return "Total Exec time";
      },
      renderCell: (item) => {
        if (isNaN(item.duration.totalTime)) {
          return <TableCellLayout truncate>{``}</TableCellLayout>;
        }
        return (
          <TableCellLayout truncate>
            {item.duration.totalTime > 1000
              ? secondsToTime(item.duration.totalTime)
              : `${item.duration.totalTime} ms`}
          </TableCellLayout>
        );
      },
    }),
    createTableColumn<Item>({
      columnId: "queuedAt",
      compare: (a, b) => {
        return b.timing.queuedAt - a.timing.queuedAt;
      },
      renderHeaderCell: () => {
        return "Queued at";
      },
      renderCell: (item) => {
        return (
          <TableCellLayout truncate>
            {item.timing.queuedAt > 1000
              ? secondsToTime(item.timing.queuedAt)
              : `${item.timing.queuedAt} ms`}
          </TableCellLayout>
        );
      },
    }),
    createTableColumn<Item>({
      columnId: "size",
      renderHeaderCell: () => {
        return "Size";
      },
      compare: (a, b) => {
        return (b.result[0]?.size || 0) - (a.result[0]?.size || 0);
      },
      renderCell: (item) => {
        return (
          <TableCellLayout truncate>
            {sizeInBytes(item.result[0]?.size)}
          </TableCellLayout>
        );
      },
    }),
  ];
};

export const getFilteredItems = (
  items: IVerboseOperation[] | null | undefined,
  searchText: string,
  filters: IFilterSet | null,
) => {
  let filteredItems = items || [];
  if (searchText.length > 0) {
    const tokens = searchText
      .split(",")
      .map((x) => x.trim())
      .filter((x) => x !== "");
    filteredItems =
      tokens.length > 0
        ? filteredItems.filter((item) => {
            return tokens.find((x) =>
              item.operationName?.toLowerCase().includes(x.toLowerCase()),
            );
          })
        : filteredItems;
  }
  if (filters) {
    // filtering based on types
    let filterTypes = filters.types.concat([]).map((x) => x.toLowerCase());
    if (filterTypes.includes(OperationType.Query.toLowerCase())) {
      filterTypes = filterTypes.concat(querySubTypes);
    }
    if (filterTypes.includes(OperationType.Fragment.toLowerCase())) {
      filterTypes = filterTypes.concat(fragmentSubTypes);
    }
    if (filterTypes.length > 0) {
      filteredItems = filteredItems.filter((item) =>
        filterTypes.includes(item.operationType.toLowerCase()),
      );
    }

    // filtering based on results
    const results = filters.results.concat([]).map((x) => x.toLowerCase());
    if (results.length > 0) {
      filteredItems = filteredItems.filter((item) => {
        const fromResult = (item.result?.[0] as IOperationResult)?.from;
        return results.includes((fromResult || "").toLowerCase());
      });
    }

    // filtering based on status
    const statuses = filters.statuses.concat([]).map((x) => x.toLowerCase());
    if (statuses.length > 0) {
      filteredItems = filteredItems.filter((item) =>
        statuses.includes(item.status.toLowerCase()),
      );
    }
  }
  return filteredItems;
};

const getOperationIcon = (type: string) => {
  switch (type) {
    case OperationType.Query: {
      return <ReadingListRegular />;
    }
    case OperationType.Mutation: {
      return <EditRegular />;
    }
    case OperationType.Subscription: {
      return <PipelineRegular />;
    }
    case OperationType.CacheReadQuery: {
      return <DatabaseSearchRegular />;
    }
    case OperationType.CacheWriteQuery: {
      return <DatabaseLinkRegular />;
    }
    case OperationType.CacheReadFragment: {
      return <BookDatabaseRegular />;
    }
    case OperationType.CacheWriteFragment: {
      return <DatabaseRegular />;
    }
    case OperationType.ClientReadFragment: {
      return <BookOpenRegular />;
    }
    case OperationType.ClientWriteFragment: {
      return <BookLetterRegular />;
    }
  }
  return null;
};

const compareString = (a: string | undefined, b: string | undefined) => {
  return (a || "").localeCompare(b || "");
};
