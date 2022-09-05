export type BaseScalars = {
  ID: string;
  Int: number;
  Float: number;
  String: string;
  Boolean: boolean;
};

export const BASE_SCALARS: Record<keyof BaseScalars, string> = {
  ID: "string",
  Int: "number",
  Float: "number",
  String: "string",
  Boolean: "boolean",
};
