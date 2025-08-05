"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.logger = void 0;
exports.createExtendedLogger = createExtendedLogger;
exports.logger = console;
function createExtendedLogger(baseLogger) {
    if (!baseLogger) {
        return undefined;
    }
    const warnings = new Set();
    return {
        // bind dynamically to the base logger methods so mocks work as expected
        debug: (...args) => baseLogger.debug(...args),
        log: (...args) => baseLogger.log(...args),
        warn: (...args) => baseLogger.warn(...args),
        error: (...args) => baseLogger.error(...args),
        // add the warnOnce method
        warnOnce(key, message) {
            if (!warnings.has(key)) {
                warnings.add(key);
                baseLogger.warn(key, message);
            }
        },
    };
}
