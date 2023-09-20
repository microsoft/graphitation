import { DocumentNode, getOperationAST } from "graphql";

export const getOperationName = (query: DocumentNode) => {
  const definition = getOperationAST(query);
  const operationName = definition ? definition.name?.value : "name_not_found";

  return operationName;
};

export const isNumber = (input: string | number | undefined = "NA") => {
  const value = parseInt(input as string, 10);
  if (isNaN(value)) {
    return false;
  }

  return true;
};

export const copyToClipboard = async (obj: unknown) => {
  await window.navigator.clipboard.writeText(JSON.stringify(obj));
};

export const secondsToTime = (time: number) => {
  const seconds = parseFloat((time / 1000).toFixed(4));
  let min = -1;
  let hour = -1;
  let format = "";
  if (seconds > 60) {
    min = parseFloat((seconds / 60).toFixed(4));
  }
  if (min > 60) {
    hour = parseFloat((min / 60).toFixed(4));
  }

  if (hour >= 1) {
    format += `${hour} hour `;
  }

  if (min >= 1) {
    format += `${min} min `;
  }

  format += `${seconds} sec`;

  return format.trim();
};

export const sizeInBytes = (size: number) => {
  if (!size) {
    return "";
  }

  const kb = parseFloat((size / 1024).toFixed(4));
  const mb = parseFloat((kb / 1024).toFixed(4));
  const gb = parseFloat((mb / 1024).toFixed(4));

  if (gb >= 1) {
    return `${gb}GB`;
  }

  if (mb >= 1) {
    return `${mb}MB`;
  }
  return `${kb}KB`;
};
