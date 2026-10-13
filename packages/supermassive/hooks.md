# Hooks Documentation

## Overview

This document describes the behaviour of hooks when they encounter errors.

## General Rule

- **Thrown Error**: Specific behaviour is applied based on the hook.
- **Returned Error**: The error is registered and execution continues.

### Hooks and Their Behaviours

#### `beforeOperationExecute`

Called before every operation

- **Thrown Error**: Stops execution and sets `data` to `null` and registers the error.
- **Returned Error**: The error is registered and execution continues.

#### `beforeSubscriptionEventEmit`

- **Thrown ErErrorror**: Sets `data` to `null` and registers the error.
- **Returned Error**: The error is registered and execution continues.

#### `beforeFieldResolve`

Called before every field resolution

`resolveInfo.isInIncrementalExecution` is `true` for field execution within a
deferred fragment or streamed item, including descendants. It is `false` for
ordinary fields, disabled defer, and initial stream items unless enclosed in
another incremental execution. It does not guarantee that an incremental result
will be emitted or delivered. No descriptor or internal execution record is
exposed; response labels are unchanged.

- **Thrown Error**: The field is not executed and is handled as if it has returned `null`.
- **Returned Error**: The error is registered and execution continues.

#### `afterFieldResolve`

Called after every field resolution.

- **Thrown Error**: The field is set to `null` and the error is registered.
- **Returned Error**: The error is registered and execution continues.

#### `afterFieldResolverReturnsPromise`

Called synchronously after a non-default field resolver returns a Promise or
thenable, before settlement handlers are attached. Receives `resolveInfo`,
`context`, and the resolved `hookContext` from `beforeFieldResolve`, if present.
It is not called for synchronous resolver results, default resolvers, or
`__typename`. An asynchronous `beforeFieldResolve` alone does not trigger it.

- **Thrown Error**: The field is set to `null` and the error is registered.
- **Return Value**: Ignored; this hook returns `void` and is not awaited.

#### `afterFieldComplete`

Called when field value is completed

- **Thrown Error**: The field is set to `null` and the error is registered.
- **Returned Error**: The error is registered and execution continues.

#### `afterBuildResponse`

Called synchronously for each built response payload, including the initial
incremental response and each subsequent response. Receives `result` and
`hasNext`, which matches the incremental payload's flag and is `false` for
non-incremental responses and terminal payloads, including completion-only
responses. Iterator cancellation does not generate a response or invoke this hook.

- **Thrown Error**: Returns no data property, only errors.
- **Returned Error**: The error is registered and execution continues.

## Additional Hooks

### `beforeFieldSubscribe`

Called before subscription event stream creation

- **Thrown or Returned Error**: Stops execution and sets `data` is `undefined` and error is returned in `errors` field.

### `afterFieldSubscribe`

Called after subscription event stream creation

- **Thrown or Returned Error**: Stops execution and sets `data` is `undefined` and error is returned in `errors` field.
