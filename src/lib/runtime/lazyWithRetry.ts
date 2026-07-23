import {
  createElement,
  lazy,
  useMemo,
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
  function RetriableLazyRoute(): ReactElement {
    const LazyRoute = useMemo(
      () =>
        lazy(
          () => importRouteWithRetry(importer),
        ),
      [importer],
    );

    return createElement(LazyRoute);
  }

  return RetriableLazyRoute;
}
