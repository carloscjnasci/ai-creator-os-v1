import {
  createElement,
  lazy,
  type ComponentType,
  type ReactElement,
} from 'react';

type RouteComponent =
  ComponentType<Record<string, never>>;

interface LazyRouteModule<
  T extends RouteComponent,
> {
  default: T;
}

const RETRY_DELAY_MS = 400;

function waitBeforeRetry(): Promise<void> {
  return new Promise((resolve) => {
    globalThis.setTimeout(
      resolve,
      RETRY_DELAY_MS,
    );
  });
}

async function importRouteWithRetry<
  T extends RouteComponent,
>(
  importer: () => Promise<LazyRouteModule<T>>,
): Promise<LazyRouteModule<T>> {
  try {
    return await importer();
  } catch (firstError) {
    await waitBeforeRetry();

    try {
      return await importer();
    } catch {
      throw firstError;
    }
  }
}

export function lazyWithRetry<
  T extends RouteComponent,
>(
  importer: () => Promise<LazyRouteModule<T>>,
): ComponentType<Record<string, never>> {
  // Create the lazy component exactly once per importer, at module scope.
  // Creating it inside the component render (e.g. via useMemo) can orphan the
  // resolved payload whenever React discards the suspended fiber, leaving the
  // Suspense fallback visible forever even after the module has loaded.
  const LazyRoute = lazy(
    () => importRouteWithRetry(importer),
  );

  function RetriableLazyRoute(): ReactElement {
    return createElement(LazyRoute);
  }

  return RetriableLazyRoute;
}
