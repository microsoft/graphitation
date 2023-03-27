export interface ICountReducerState {
  verboseOperationsCount: number;
  allOperationsCount: number;
  cacheOperationsCount: number;
}

export enum CountReducerActionEnum {
  UpdateVerboseOperationsCount,
  UpdateAllOperationsCount,
  UpdateCacheOperationsCount,

  ClearVerboseOperations,
}

export interface ICountReducerAction {
  type: CountReducerActionEnum;
  value: any;
}
