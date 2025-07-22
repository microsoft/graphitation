export type Logger = {
  debug: typeof console.debug;
  log: typeof console.log;
  warn: typeof console.warn;
  error: typeof console.error;
};

export const logger: Logger = console;

export type ExtendedLogger = Logger & {
  warnOnce: (key: string, message: string) => void;
};

export function createExtendedLogger(
  baseLogger: Logger | undefined,
): ExtendedLogger | undefined {
  if (!baseLogger) {
    return undefined;
  }

  const warnings = new Set<string>();

  return {
    // bind dynamically to the base logger methods so mocks work as expected
    debug: (...args) => baseLogger.debug(...args),
    log: (...args) => baseLogger.log(...args),
    warn: (...args) => baseLogger.warn(...args),
    error: (...args) => baseLogger.error(...args),
    // add the warnOnce method
    warnOnce(key: string, message: string): void {
      if (!warnings.has(key)) {
        warnings.add(key);
        baseLogger.warn(key, message);
      }
    },
  };
}
