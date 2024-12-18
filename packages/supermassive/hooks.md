# Hooks Documentation

## Overview

This document describes the behaviour of hooks when they encounter errors.

## General Rule

- **Returned Errors**: The error is registered and execution continues.
- **Thrown Errors**: Specific behaviour is applied based on the hook.

### Hooks and Their Behaviours

#### `beforeOperationExecute`

- **Thrown Error**: Stops execution and sets `data` to `null` and registers the error.
- **Returned Errors**: Registers the error and moves one.

#### `beforeSubscriptionEventEmit`

- **Thrown Error**: Sets `data` to `null` and registers the error.
- **Returned Errors**: Registers the error and moves one.

#### `beforeFieldResolve`

- **Thrown Error**: The field is not executed and is handled as if it has returned `null`.
- **Returned Errors**: Registers the error and moves one.

#### `afterFieldResolve`

- **Thrown Error**: The field is set to `null` and the error is registered.
- **Returned Errors**: Registers the error and moves one.

#### `afterFieldComplete`

- **Thrown Error**: The field is set to `null` and the error is registered.
- **Returned Errors**: Registers the error and moves one.

#### `afterBuildResponse`

- **Thrown Error**: Returns no data property, only errors.
- **Returned Errors**: Registers the error and moves one.

## Additional Hooks (Update 9.12)

### `beforeFieldSubscribe`

- **Thrown or Returned Error**: Throws the error regardless of whether it is returned or thrown.

### `afterFieldSubscribe`

- **Thrown or Returned Error**: Throws the error regardless of whether it is returned or thrown.
