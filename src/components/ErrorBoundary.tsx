"use client";

import {
  Component,
  Fragment,
  type ErrorInfo,
  type ReactNode,
} from "react";

type Props = {
  children: ReactNode;
  /** Optional label for the retry control */
  title?: string;
};

type State = {
  hasError: boolean;
  resetKey: number;
};

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, resetKey: 0 };

  static getDerivedStateFromError(): Partial<State> {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error("[ErrorBoundary]", error.message, error.stack, info.componentStack);
  }

  private handleRetry = (): void => {
    this.setState((s) => ({
      hasError: false,
      resetKey: s.resetKey + 1,
    }));
  };

  render(): ReactNode {
    if (this.state.hasError) {
      return (
        <div
          role="alert"
          className="mx-auto flex min-h-[40vh] max-w-md flex-col items-center justify-center gap-4 px-6 py-16 text-center"
        >
          <div className="rounded-2xl border border-muted/25 bg-surface px-6 py-8 shadow-sm">
            <h2 className="text-lg font-semibold text-text">
              {this.props.title ?? "Something went wrong"}
            </h2>
            <p className="mt-2 text-sm text-muted">
              This section hit an unexpected error. You can try again or refresh
              the page.
            </p>
            <button
              type="button"
              onClick={this.handleRetry}
              className="mt-6 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-white transition hover:opacity-95"
            >
              Try again
            </button>
          </div>
        </div>
      );
    }

    return (
      <Fragment key={this.state.resetKey}>{this.props.children}</Fragment>
    );
  }
}
