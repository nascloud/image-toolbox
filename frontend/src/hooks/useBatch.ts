import { useState, useCallback } from 'react';
import { useProgressContext } from './useProgress';

export interface BatchState {
  running: boolean;
  result: any | null;
}

export function useBatch() {
  const [state, setState] = useState<BatchState>({
    running: false,
    result: null,
  });

  const { updateProgress } = useProgressContext();

  const startBatch = useCallback(async (method: string, request: any) => {
    setState({ running: true, result: null });
    updateProgress({ completed: 0, total: 0, current: '', running: true, done: false });

    try {
      const fn = (window as any).go.main.App[method];
      if (!fn) throw new Error(`Wails method not found: ${method}`);
      const result = await fn(request);
      setState({ running: false, result });
      return result;
    } catch (err: any) {
      setState({ running: false, result: { error: err.message } });
    }
  }, [updateProgress]);

  const cancelBatch = useCallback(async () => {
    updateProgress(null);
    try {
      await (window as any).go.main.App.CancelBatch();
    } catch { /* no-op */ }
  }, [updateProgress]);

  const openOutputDir = useCallback(async (dir: string) => {
    try {
      await (window as any).go.main.App.OpenOutputDir(dir);
    } catch { /* no-op */ }
  }, []);

  return { state, startBatch, cancelBatch, openOutputDir };
}
