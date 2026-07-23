import React, { Component, ErrorInfo, ReactNode } from 'react';
import { useTranslation } from '../../features/i18n/useTranslation';

interface AppErrorBoundaryProps {
  children: ReactNode;
}

interface AppErrorBoundaryState {
  hasError: boolean;
}

interface AppErrorBoundaryInnerProps extends AppErrorBoundaryProps {
  t: (key: string) => string;
}

class AppErrorBoundaryInner extends Component<
  AppErrorBoundaryInnerProps,
  AppErrorBoundaryState
> {
  constructor(props: AppErrorBoundaryInnerProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): AppErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    // No telemetry sent
  }

  handleRetry = (): void => {
    this.setState({ hasError: false });
  };

  handleGoToDashboard = (): void => {
    window.location.assign('/dashboard');
  };

  render(): ReactNode {
    const { t } = this.props;
    if (this.state.hasError) {
      return (
        <div
          role="alert"
          className="flex min-h-[60vh] flex-col items-center justify-center px-6 py-12 text-center"
        >
          <div className="max-w-md rounded-xl border border-border bg-card p-8 shadow-sm">
            <h2 className="text-xl font-semibold tracking-tight text-foreground sm:text-2xl animate-fade-in">
              {t('pages.shared.somethingWentWrong')}
            </h2>
            <p className="mt-3 text-sm text-muted-foreground">
              {t('pages.shared.boundaryExplanation')}
            </p>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
              <button
                type="button"
                onClick={this.handleRetry}
                className="inline-flex h-9 items-center justify-center rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-sm hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                {t('pages.shared.tryAgain')}
              </button>
              <button
                type="button"
                onClick={this.handleGoToDashboard}
                className="inline-flex h-9 items-center justify-center rounded-lg border border-input bg-background px-4 py-2 text-sm font-medium text-foreground shadow-sm hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                {t('pages.shared.goToDashboard')}
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export function AppErrorBoundary(props: AppErrorBoundaryProps) {
  const { t } = useTranslation();
  return <AppErrorBoundaryInner {...props} t={t} />;
}

