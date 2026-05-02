import { useState, useCallback } from 'react';

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

  return { state, startBatch };
}
