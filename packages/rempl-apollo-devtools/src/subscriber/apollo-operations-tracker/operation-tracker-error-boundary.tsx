import React from "react";
import { Button, Title2 } from "@fluentui/react-components";

export interface IErrorBoundaryState {
  error?: IError;
}
export interface IError {
  error?: boolean;
  message?: string;
}
export class ErrorBoundary extends React.PureComponent<
  React.PropsWithChildren<unknown>,
  IErrorBoundaryState
> {
  public state: IErrorBoundaryState = {};

  public componentDidCatch(): void {
    this.setState({ error: { error: true, message: "Something went wrong" } });
  }

  public render(): JSX.Element {
    const { children } = this.props;

    if (this.state.error?.error) {
      return (
        <div>
          <Title2>{this.state.error.message}</Title2>
          <Button onClick={this.resetError}>Retry</Button>
        </div>
      );
    }

    return children as JSX.Element;
  }

  private resetError() {
    this.setState({
      error: undefined,
    });
  }
}
