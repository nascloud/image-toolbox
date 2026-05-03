import { useState, useCallback, useEffect, useRef } from 'react';
import { EventsOn, EventsOff } from '../../wailsjs/runtime';

export interface ProgressUpdate {
  completed: number;
  total: number;
  current: string;
  error?: string;
  done: boolean;
}

export interface BatchState {
  running: boolean;
  progress: ProgressUpdate | null;
  result: any | null;
}

export function useBatch() {
  const [state, setState] = useState<BatchState>({
    running: false,
    progress: null,
    result: null,
  });

  // Register progress listener once on mount
  useEffect(() => {
    EventsOn('batch-progress', (update: ProgressUpdate) => {
      setState(prev => ({ ...prev, progress: update }));
    });
    return () => {
      EventsOff('batch-progress');
    };
  }, []);

  const startBatch = useCallback(async (method: string, request: any) => {
    setState({ running: true, progress: null, result: null });

    try {
      const fn = (window as any).go.main.App[method];
      if (!fn) throw new Error(`Wails method not found: ${method}`);
      const result = await fn(request);
      setState({ running: false, progress: null, result });
      return result;
    } catch (err: any) {
      setState({ running: false, progress: null, result: { error: err.message } });
    }
  }, []);

  const cancelBatch = useCallback(async () => {
    try {
      await (window as any).go.main.App.CancelBatch();
    } catch { /* no-op */ }
  }, []);

  const openOutputDir = useCallback(async (dir: string) => {
    try {
      await (window as any).go.main.App.OpenOutputDir(dir);
    } catch { /* no-op */ }
  }, []);

  return { state, startBatch, cancelBatch, openOutputDir };
}
