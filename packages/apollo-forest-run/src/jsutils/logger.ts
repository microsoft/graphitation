export type Logger = {
  debug: typeof console.debug;
  log: typeof console.log;
  warn: typeof console.warn;
  error: typeof console.error;
};

export const logger: Logger = console;
