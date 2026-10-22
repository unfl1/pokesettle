import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { battleApi } from '../api';

export function useAnalysis<T>(path: string, payload: unknown) {
  const value = JSON.stringify(payload);
  const [snapshot, setSnapshot] = useState<string | null>(null);
  const current = snapshot === value;
  const query = useQuery({
    queryKey: ['analysis', path, snapshot],
    queryFn: () => battleApi.analyze<T>(path, JSON.parse(snapshot!)),
    enabled: current,
    retry: false,
    staleTime: Infinity,
  });
  return {
    data: current ? query.data : undefined,
    error: current ? query.error : null,
    busy: current && query.isFetching,
    run: () => {
      if (current) void query.refetch();
      else setSnapshot(value);
    },
  };
}
