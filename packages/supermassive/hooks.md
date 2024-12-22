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

- **Thrown Error**: The field is not executed and is handled as if it has returned `null`.
- **Returned Error**: The error is registered and execution continues.

#### `afterFieldResolve`

Called after every field resolution.

- **Thrown Error**: The field is set to `null` and the error is registered.
- **Returned Error**: The error is registered and execution continues.

#### `afterFieldComplete`

Called when field value is completed

- **Thrown Error**: The field is set to `null` and the error is registered.
- **Returned Error**: The error is registered and execution continues.

#### `afterBuildResponse`

- **Thrown Error**: Returns no data property, only errors.
- **Returned Error**: The error is registered and execution continues.

## Additional Hooks

### `beforeFieldSubscribe`

Called before subscription event stream creation

- **Thrown or Returned Error**: Stops execution and sets `data` is `undefined` and error is returned in `errors` field.

### `afterFieldSubscribe`

Called after subscription event stream creation

- **Thrown or Returned Error**: Stops execution and sets `data` is `undefined` and error is returned in `errors` field.
