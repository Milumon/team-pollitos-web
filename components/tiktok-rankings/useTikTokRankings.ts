'use client';

import { useEffect, useState } from 'react';
import type { CurrentRankings, RankingsState } from './types';

// Global in-memory cache for instant navigation without loading flicker
const rankingsMemoryCache = new Map<string, { data: CurrentRankings; timestamp: number }>();
const CACHE_TTL_MS = 60_000; // 1 minute fresh cache

export function useTikTokRankings(accessToken?: string | null, limit = 100, batchId?: string | null): RankingsState {
  const cacheKey = `${accessToken || 'anon'}_${limit}_${batchId || 'latest'}`;
  const cached = rankingsMemoryCache.get(cacheKey);

  const [state, setState] = useState<RankingsState>(() => {
    if (cached) {
      return { data: cached.data, loading: false, error: null };
    }
    return { data: null, loading: true, error: null };
  });

  useEffect(() => {
    let cancelled = false;
    const now = Date.now();

    // If cache is fresh, don't show loading state
    if (cached && now - cached.timestamp < CACHE_TTL_MS) {
      setState({ data: cached.data, loading: false, error: null });
      return;
    }

    // If we have stale cache, show data while background revalidating
    if (cached) {
      setState({ data: cached.data, loading: false, error: null });
    } else {
      setState((prev) => (prev.data ? prev : { data: null, loading: true, error: null }));
    }

    const headers: HeadersInit = accessToken ? { Authorization: `Bearer ${accessToken}` } : {};
    const batchQuery = batchId ? `&batch_id=${encodeURIComponent(batchId)}` : '';

    fetch(`/api/tiktok/rankings/current?limit=${limit}${batchQuery}`, { headers })
      .then(async (response) => {
        const body = await response.json() as CurrentRankings | { error?: string };
        if (!response.ok) throw new Error('error' in body && body.error ? body.error : 'No se pudo cargar el ranking.');
        return body as CurrentRankings;
      })
      .then((data) => {
        if (!cancelled) {
          rankingsMemoryCache.set(cacheKey, { data, timestamp: Date.now() });
          setState({ data, loading: false, error: null });
        }
      })
      .catch((error: unknown) => {
        if (!cancelled && !cached) {
          setState({ data: null, loading: false, error: error instanceof Error ? error.message : 'No se pudo cargar el ranking.' });
        }
      });

    return () => { cancelled = true; };
  }, [accessToken, limit, batchId, cacheKey]);

  return state;
}