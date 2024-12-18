# Hooks Documentation

## Overview

This document describes the behaviour of hooks when they encounter errors.

## General Rule

- **Returned Errors**: The error is registered and execution continues.
- **Thrown Errors**: Specific behaviour is applied based on the hook.

### Hooks and Their Behaviours

#### `beforeOperationExecute`

Called before every operation

- **Thrown Error**: Stops execution and sets `data` to `null` and registers the error.
- **Returned Errors**: Registers the error and moves one.

#### `beforeSubscriptionEventEmit`

- **Thrown Error**: Sets `data` to `null` and registers the error.
- **Returned Errors**: Registers the error and moves one.

#### `beforeFieldResolve`

Called before every field resolution

- **Thrown Error**: The field is not executed and is handled as if it has returned `null`.
- **Returned Errors**: Registers the error and moves one.

#### `afterFieldResolve`

Called after every field resolution.

- **Thrown Error**: The field is set to `null` and the error is registered.
- **Returned Errors**: Registers the error and moves one.

#### `afterFieldComplete`

Called when field value is completed

- **Thrown Error**: The field is set to `null` and the error is registered.
- **Returned Errors**: Registers the error and moves one.

#### `afterBuildResponse`

- **Thrown Error**: Returns no data property, only errors.
- **Returned Errors**: Registers the error and moves one.

## Additional Hooks

### `beforeFieldSubscribe`

Called before subscription event stream creation

- **Thrown or Returned Error**: Throws the error regardless of whether it is returned or thrown.

### `afterFieldSubscribe`

Called after subscription event stream creation

- **Thrown or Returned Error**: Throws the error regardless of whether it is returned or thrown.
