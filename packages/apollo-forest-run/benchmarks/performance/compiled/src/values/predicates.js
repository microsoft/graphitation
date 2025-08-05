"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isRootRef = exports.isParentListRef = exports.isParentObjectRef = exports.isMissingValue = exports.isMissingLeafValue = exports.isAggregate = exports.isLeafValue = exports.isSimpleLeafValue = exports.isComplexLeafValue = exports.isComplexValue = exports.isCompositeValue = exports.isLeafErrorValue = exports.isCompositeUndefinedValue = exports.isCompositeNullValue = exports.isLeafNull = exports.isComplexScalarValue = exports.isScalarValue = exports.isLeafListValue = exports.isCompositeListValue = exports.isNodeValue = exports.isObjectValue = exports.isSourceCompositeValue = exports.isSourceScalar = exports.isSourceObject = void 0;
exports.isDeletedValue = isDeletedValue;
exports.isCompatibleValue = isCompatibleValue;
const types_1 = require("./types");
const assert_1 = require("../jsutils/assert");
const isSourceObject = (value) => typeof value === "object" && value !== null;
exports.isSourceObject = isSourceObject;
const isSourceScalar = (value) => typeof value === "number" ||
    typeof value === "boolean" ||
    typeof value === "string" ||
    typeof value === "bigint";
exports.isSourceScalar = isSourceScalar;
const isSourceCompositeValue = (value, field) => field.selection
    ? typeof value === "object" || value === undefined // object, null, array, undefined
    : false;
exports.isSourceCompositeValue = isSourceCompositeValue;
const isObjectValue = (value) => typeof value === "object" &&
    value !== null &&
    value.kind === types_1.ValueKind.Object;
exports.isObjectValue = isObjectValue;
const isNodeValue = (value) => (0, exports.isObjectValue)(value) && typeof value.key === "string";
exports.isNodeValue = isNodeValue;
const isCompositeListValue = (value) => typeof value === "object" &&
    value !== null &&
    value.kind === types_1.ValueKind.CompositeList;
exports.isCompositeListValue = isCompositeListValue;
const isLeafListValue = (value) => typeof value === "object" &&
    value !== null &&
    value.kind === types_1.ValueKind.LeafList;
exports.isLeafListValue = isLeafListValue;
const isScalarValue = (value) => (0, exports.isSourceScalar)(value);
exports.isScalarValue = isScalarValue;
const isComplexScalarValue = (value) => typeof value === "object" &&
    value !== null &&
    value.kind === types_1.ValueKind.ComplexScalar;
exports.isComplexScalarValue = isComplexScalarValue;
const isLeafNull = (value) => value === null;
exports.isLeafNull = isLeafNull;
const isCompositeNullValue = (value) => typeof value === "object" &&
    value !== null &&
    value.kind === types_1.ValueKind.CompositeNull;
exports.isCompositeNullValue = isCompositeNullValue;
const isCompositeUndefinedValue = (value) => typeof value === "object" &&
    value !== null &&
    value.kind === types_1.ValueKind.CompositeUndefined;
exports.isCompositeUndefinedValue = isCompositeUndefinedValue;
const isLeafErrorValue = (value) => typeof value === "object" &&
    value !== null &&
    value.kind === types_1.ValueKind.LeafError;
exports.isLeafErrorValue = isLeafErrorValue;
const CompositeValueTypes = [
    types_1.ValueKind.Object,
    types_1.ValueKind.CompositeList,
    types_1.ValueKind.CompositeNull,
    types_1.ValueKind.CompositeUndefined,
];
const isCompositeValue = (value) => typeof value === "object" &&
    value !== null &&
    CompositeValueTypes.includes(value.kind);
exports.isCompositeValue = isCompositeValue;
const ComplexLeafValueTypes = [
    types_1.ValueKind.LeafList,
    types_1.ValueKind.LeafError,
    types_1.ValueKind.ComplexScalar,
    types_1.ValueKind.LeafUndefined,
];
const isComplexValue = (value) => (0, exports.isCompositeValue)(value) || (0, exports.isComplexLeafValue)(value);
exports.isComplexValue = isComplexValue;
const isComplexLeafValue = (value) => typeof value === "object" &&
    value !== null &&
    ComplexLeafValueTypes.includes(value.kind);
exports.isComplexLeafValue = isComplexLeafValue;
const isSimpleLeafValue = (value) => typeof value !== "object";
exports.isSimpleLeafValue = isSimpleLeafValue;
const isLeafValue = (value) => (0, exports.isSimpleLeafValue)(value) || (0, exports.isComplexLeafValue)(value);
exports.isLeafValue = isLeafValue;
const isAggregate = (value) => value.isAggregate === true;
exports.isAggregate = isAggregate;
const isMissingLeafValue = (value) => typeof value === "object" &&
    value !== null &&
    value.kind === types_1.ValueKind.LeafUndefined;
exports.isMissingLeafValue = isMissingLeafValue;
function isDeletedValue(value) {
    if ((0, exports.isMissingLeafValue)(value)) {
        return value.deleted;
    }
    if (!(0, exports.isCompositeUndefinedValue)(value)) {
        return false;
    }
    return (0, exports.isAggregate)(value)
        ? value.chunks.every((chunk) => chunk.deleted)
        : value.deleted;
}
const isMissingValue = (value) => typeof value === "object" && value !== null && value.data === undefined;
exports.isMissingValue = isMissingValue;
function isCompatibleValue(value, other) {
    if ((0, exports.isSimpleLeafValue)(value)) {
        if ((0, exports.isSimpleLeafValue)(other)) {
            return typeof value === typeof other || value === null || other === null;
        }
        if ((0, exports.isComplexLeafValue)(other)) {
            return other.data == null;
        }
        return false;
    }
    if ((0, exports.isComplexLeafValue)(value)) {
        if ((0, exports.isComplexLeafValue)(other)) {
            return (value.kind === other.kind || value.data == null || other.data == null);
        }
        if ((0, exports.isSimpleLeafValue)(other)) {
            return value.data == null;
        }
        return false;
    }
    if ((0, exports.isCompositeValue)(value)) {
        if ((0, exports.isCompositeValue)(other)) {
            return (value.kind === other.kind || other.data == null || value.data == null);
        }
        return false;
    }
    (0, assert_1.assertNever)(value);
}
const isParentObjectRef = (parentRef) => parentRef.field !== undefined;
exports.isParentObjectRef = isParentObjectRef;
const isParentListRef = (parentRef) => parentRef.index !== undefined;
exports.isParentListRef = isParentListRef;
const isRootRef = (parentRef) => parentRef.parent === null;
exports.isRootRef = isRootRef;
