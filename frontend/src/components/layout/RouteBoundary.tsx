import { Suspense, type ReactNode } from 'react';
import { headers } from 'next/headers';
import RouteLoading from './RouteLoading';

export default async function RouteBoundary({ children, fallback }: { children: ReactNode; fallback?: ReactNode }) {
  // Stream client transitions, but deliver complete HTML to non-JavaScript visitors.
  const isClientNavigation = (await headers()).get('sec-fetch-dest') === 'empty';
  return isClientNavigation ? <Suspense fallback={fallback ?? <RouteLoading />}>{children}</Suspense> : children;
}
