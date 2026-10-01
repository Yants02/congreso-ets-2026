'use client';

import { useState, useEffect, useCallback } from 'react';

export function useBackendSyncStatus(pollIntervalMs: number = 30000) {
  // null = comprobando inicialmente, true = sincronizado (verde), false = desconectado/error (rojo)
  const [isSynced, setIsSynced] = useState<boolean | null>(null);
  const [lastCheck, setLastCheck] = useState<Date | null>(null);

  const checkSync = useCallback(async () => {
    if (typeof window !== 'undefined' && !navigator.onLine) {
      setIsSynced(false);
      setLastCheck(new Date());
      return;
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4000);

      const res = await fetch('/api/health', {
        method: 'GET',
        cache: 'no-store',
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (res.ok) {
        const data = await res.json().catch(() => null);
        // El backend devuelve { status: 'UP', database: { connected: true, ... } }
        if (data && (data.status === 'UP' || data.database?.connected === true)) {
          setIsSynced(true);
        } else {
          setIsSynced(false);
        }
      } else {
        setIsSynced(false);
      }
    } catch {
      setIsSynced(false);
    } finally {
      setLastCheck(new Date());
    }
  }, []);

  useEffect(() => {
    checkSync();

    const interval = setInterval(checkSync, pollIntervalMs);

    const handleOnline = () => checkSync();
    const handleOffline = () => setIsSynced(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      clearInterval(interval);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [checkSync, pollIntervalMs]);

  return { isSynced, checkSync, lastCheck };
}
