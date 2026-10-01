'use client';

import { useState, useEffect, useCallback } from 'react';
import { openDB, IDBPDatabase } from 'idb';

const DB_NAME = 'ets_acreditaciones_db';
const STORE_NAME = 'queue_acreditaciones';

export function playAudioFeedback(type: 'success' | 'error' | 'offline_queued') {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.connect(gain);
    gain.connect(ctx.destination);

    if (type === 'success') {
      osc.frequency.setValueAtTime(880, ctx.currentTime); // Nota A5 (agudo confirmación)
      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      osc.start();
      osc.stop(ctx.currentTime + 0.15);
    } else if (type === 'offline_queued') {
      osc.frequency.setValueAtTime(440, ctx.currentTime); // Nota A4 (tono medio diferido)
      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      osc.start();
      osc.stop(ctx.currentTime + 0.3);
    } else if (type === 'error') {
      osc.frequency.setValueAtTime(220, ctx.currentTime); // Nota A3 (grave rechazo)
      gain.gain.setValueAtTime(0.25, ctx.currentTime);
      osc.start();
      osc.stop(ctx.currentTime + 0.4);
    }
  } catch (_) {
    // Si el navegador bloquea audio sin interacción de usuario previa
  }
}

export function useOfflineAcreditacion() {
  const [isOnline, setIsOnline] = useState<boolean>(
    typeof window !== 'undefined' ? navigator.onLine : true
  );
  const [pendingCount, setPendingCount] = useState<number>(0);

  const initDb = async (): Promise<IDBPDatabase> => {
    return openDB(DB_NAME, 1, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
        }
      },
    });
  };

  const updatePendingCount = useCallback(async () => {
    try {
      const db = await initDb();
      const count = await db.count(STORE_NAME);
      setPendingCount(count);
    } catch (_) {}
  }, []);

  const syncAcreditaciones = useCallback(async () => {
    try {
      const db = await initDb();
      const records = await db.getAll(STORE_NAME);

      if (records.length === 0) return;

      const response = await fetch('/api/operator/acreditar-batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ acreditaciones: records }),
      });

      if (response.ok) {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        await tx.objectStore(STORE_NAME).clear();
        await tx.done;
        await updatePendingCount();
        playAudioFeedback('success');
      }
    } catch (_err) {
      console.warn('Sincronización diferida. Se reintentará al recuperar señal.');
    }
  }, [updatePendingCount]);

  useEffect(() => {
    updatePendingCount();

    const handleOnline = () => {
      setIsOnline(true);
      syncAcreditaciones();
    };

    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [updatePendingCount, syncAcreditaciones]);

  const queueAcreditacion = async (data: {
    qr_token: string;
    tipo_acreditacion_id: number;
    punto_acceso_id: number;
    actividad_id?: number | null;
    operador_id?: number | null;
    tipo_movimiento?: 'INGRESO' | 'EGRESO';
  }) => {
    const db = await initDb();
    await db.add(STORE_NAME, { ...data, timestamp: new Date().toISOString() });
    await updatePendingCount();

    if (navigator.onLine) {
      await syncAcreditaciones();
    } else {
      playAudioFeedback('offline_queued');
    }
  };

  return { isOnline, pendingCount, queueAcreditacion, syncAcreditaciones };
}
